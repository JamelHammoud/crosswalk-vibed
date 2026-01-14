const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

interface VercelDeployment {
  uid: string;
  url: string;
  state: string;
  name: string;
  source?: string;
  target?: string;
  meta?: Record<string, string>;
  gitSource?: {
    ref?: string;
    repoId?: string;
    sha?: string;
    type?: string;
  };
  createdAt: number;
}

export interface DeploymentStatus {
  state: "BUILDING" | "READY" | "ERROR" | "QUEUED" | "CANCELED" | "NOT_FOUND";
  url?: string;
  createdAt?: number;
}

export async function getDeploymentStatus(
  branchName: string
): Promise<DeploymentStatus> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return { state: "NOT_FOUND" };
  }

  try {
    const params = new URLSearchParams({
      limit: "20",
      projectId: VERCEL_PROJECT_ID,
    });

    if (VERCEL_TEAM_ID) {
      params.set("teamId", VERCEL_TEAM_ID);
    }

    const response = await fetch(
      `https://api.vercel.com/v6/deployments?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return { state: "NOT_FOUND" };
    }

    const data = await response.json();
    const deployments: VercelDeployment[] = data.deployments || [];

    const deployment = deployments.find((d) => {
      const possibleBranches = [
        d.meta?.githubCommitRef,
        d.gitSource?.ref,
        d.source,
      ].filter(Boolean);

      return possibleBranches.some(
        (b) => b === branchName || b?.toLowerCase() === branchName.toLowerCase()
      );
    });

    if (!deployment) {
      return { state: "NOT_FOUND" };
    }

    return {
      state: deployment.state as DeploymentStatus["state"],
      url:
        deployment.state === "READY" ? `https://${deployment.url}` : undefined,
      createdAt: deployment.createdAt,
    };
  } catch {
    return { state: "NOT_FOUND" };
  }
}

export async function getDeploymentForBranch(
  branchName: string
): Promise<string | null> {
  if (!VERCEL_TOKEN) {
    console.error("VERCEL_TOKEN not set");
    return null;
  }

  if (!VERCEL_PROJECT_ID) {
    console.error("VERCEL_PROJECT_ID not set");
    return null;
  }

  try {
    const params = new URLSearchParams({
      limit: "100",
      projectId: VERCEL_PROJECT_ID,
    });

    // Team ID is required for team-owned projects
    if (VERCEL_TEAM_ID) {
      params.set("teamId", VERCEL_TEAM_ID);
    } else {
      console.warn("VERCEL_TEAM_ID not set - may get 403 for team projects");
    }

    const response = await fetch(
      `https://api.vercel.com/v6/deployments?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vercel API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const deployments: VercelDeployment[] = data.deployments || [];

    console.log(`Looking for branch: "${branchName}"`);
    console.log(`Total deployments: ${deployments.length}`);

    // Find READY deployment matching our branch
    const deployment = deployments.find((d) => {
      if (d.state !== "READY") return false;

      // Check multiple possible locations for branch name
      const possibleBranches = [
        d.meta?.githubCommitRef,
        d.meta?.gitlabCommitRef,
        d.meta?.bitbucketCommitRef,
        d.source,
        d.gitSource?.ref,
      ].filter(Boolean);

      // Also check all meta values
      if (d.meta) {
        Object.values(d.meta).forEach((v) => {
          if (typeof v === "string") possibleBranches.push(v);
        });
      }

      const matches = possibleBranches.some(
        (b) => b === branchName || b?.toLowerCase() === branchName.toLowerCase()
      );

      if (matches) {
        console.log(`✓ Found matching deployment: ${d.url}`);
        return true;
      }

      return false;
    });

    if (deployment) {
      return `https://${deployment.url}`;
    }

    // Log what we found for debugging
    const readyDeployments = deployments.filter((d) => d.state === "READY");
    console.log(`Ready deployments: ${readyDeployments.length}`);
    readyDeployments.slice(0, 3).forEach((d, i) => {
      console.log(`[${i}] ${d.url}`);
      console.log(`    source: ${d.source}`);
      console.log(`    gitSource.ref: ${d.gitSource?.ref}`);
      console.log(`    meta.githubCommitRef: ${d.meta?.githubCommitRef}`);
    });

    console.log("No matching deployment found");
    return null;
  } catch (err) {
    console.error("Failed to fetch Vercel deployments:", err);
    return null;
  }
}
