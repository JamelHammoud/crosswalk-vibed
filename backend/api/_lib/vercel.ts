const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

interface VercelDeployment {
  uid: string;
  url: string;
  state: string;
  meta?: {
    githubCommitRef?: string;
  };
  createdAt: number;
}

export async function getDeploymentForBranch(
  branchName: string
): Promise<string | null> {
  if (!VERCEL_TOKEN) {
    console.error("VERCEL_TOKEN not set");
    return null;
  }

  try {
    // Build query params
    const params = new URLSearchParams({
      limit: "50",
      state: "READY",
    });

    if (VERCEL_PROJECT_ID) {
      params.set("projectId", VERCEL_PROJECT_ID);
    }

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
      console.error(
        "Vercel API error:",
        response.status,
        await response.text()
      );
      return null;
    }

    const data = await response.json();
    const deployments: VercelDeployment[] = data.deployments || [];

    // Find the most recent deployment for this branch
    const deployment = deployments.find(
      (d) => d.meta?.githubCommitRef === branchName && d.state === "READY"
    );

    if (deployment) {
      return `https://${deployment.url}`;
    }

    return null;
  } catch (err) {
    console.error("Failed to fetch Vercel deployments:", err);
    return null;
  }
}
