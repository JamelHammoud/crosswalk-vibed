import { Octokit } from "octokit";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "crosswalk-app";
const REPO_NAME = process.env.GITHUB_REPO_NAME || "crosswalk-vibed";
const DEFAULT_BRANCH = "main";

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

export interface FileChange {
  path: string;
  content: string;
  action: "create" | "update" | "delete";
}

export interface BranchInfo {
  name: string;
  sha: string;
  url: string;
  aheadBy: number;
  behindBy: number;
}

export async function createBranch(branchName: string): Promise<BranchInfo> {
  const kit = getOctokit();

  const { data: mainRef } = await kit.rest.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${DEFAULT_BRANCH}`,
  });

  try {
    await kit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: mainRef.object.sha,
    });
  } catch (err: any) {
    if (err.status !== 422) {
      throw err;
    }
  }

  const { data: branchRef } = await kit.rest.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${branchName}`,
  });

  return {
    name: branchName,
    sha: branchRef.object.sha,
    url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/tree/${branchName}`,
    aheadBy: 0,
    behindBy: 0,
  };
}

export async function getFile(
  path: string,
  branch: string = DEFAULT_BRANCH
): Promise<{ content: string; sha: string } | null> {
  const kit = getOctokit();

  try {
    const { data } = await kit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path,
      ref: branch,
    });

    if ("content" in data && data.type === "file") {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return { content, sha: data.sha };
    }
    return null;
  } catch (err: any) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function commitFiles(
  branch: string,
  files: FileChange[],
  commitMessage: string
): Promise<{ sha: string; url: string }> {
  const kit = getOctokit();

  const { data: branchRef } = await kit.rest.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${branch}`,
  });
  const baseSha = branchRef.object.sha;

  const { data: baseCommit } = await kit.rest.git.getCommit({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    commit_sha: baseSha,
  });
  const baseTreeSha = baseCommit.tree.sha;

  const treeItems = await Promise.all(
    files
      .filter((f) => f.action !== "delete")
      .map(async (file) => {
        const { data: blob } = await kit.rest.git.createBlob({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        });

        return {
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        };
      })
  );

  files
    .filter((f) => f.action === "delete")
    .forEach((file) => {
      treeItems.push({
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: null as any,
      });
    });

  const { data: newTree } = await kit.rest.git.createTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  const { data: newCommit } = await kit.rest.git.createCommit({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    message: commitMessage,
    tree: newTree.sha,
    parents: [baseSha],
  });

  await kit.rest.git.updateRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  return {
    sha: newCommit.sha,
    url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/commit/${newCommit.sha}`,
  };
}

export async function createPullRequest(
  branch: string,
  title: string,
  body: string
): Promise<{ number: number; url: string }> {
  const kit = getOctokit();

  const { data: existingPRs } = await kit.rest.pulls.list({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    head: `${REPO_OWNER}:${branch}`,
    state: "open",
  });

  if (existingPRs.length > 0) {
    return {
      number: existingPRs[0].number,
      url: existingPRs[0].html_url,
    };
  }

  const { data: pr } = await kit.rest.pulls.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title,
    body,
    head: branch,
    base: DEFAULT_BRANCH,
  });

  return {
    number: pr.number,
    url: pr.html_url,
  };
}

export async function getBranchComparison(
  branch: string
): Promise<{ aheadBy: number; behindBy: number; files: string[] }> {
  const kit = getOctokit();

  try {
    const { data } = await kit.rest.repos.compareCommits({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      base: DEFAULT_BRANCH,
      head: branch,
    });

    return {
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
      files: data.files?.map((f) => f.filename) || [],
    };
  } catch {
    return { aheadBy: 0, behindBy: 0, files: [] };
  }
}

export async function resetBranchToMain(branch: string): Promise<void> {
  const kit = getOctokit();

  const { data: mainRef } = await kit.rest.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${DEFAULT_BRANCH}`,
  });

  await kit.rest.git.updateRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${branch}`,
    sha: mainRef.object.sha,
    force: true,
  });
}

export async function listFiles(
  path: string = "",
  branch: string = DEFAULT_BRANCH
): Promise<{ name: string; path: string; type: "file" | "dir" }[]> {
  const kit = getOctokit();

  try {
    const { data } = await kit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path,
      ref: branch,
    });

    if (Array.isArray(data)) {
      return data.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type === "dir" ? "dir" : "file",
      }));
    }
    return [];
  } catch {
    return [];
  }
}
