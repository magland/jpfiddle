/* eslint-disable @typescript-eslint/no-explicit-any */
import { Octokit } from "@octokit/rest";
import allowCors from "../apiHelpers/allowCors";
import { isCommitGitHubChangesRequest } from "../apiHelpers/types";
import gitHubCreateOrUpdateFiles from "../apiHelpers/gitHubCreateOrUpdateFiles";

export default allowCors(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const rr = req.body;
  if (!isCommitGitHubChangesRequest(rr)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { repo, changes, branch } = rr;
  const accessToken = req.headers.authorization?.split(" ")[1]; // Extract the token

  if (!accessToken) {
    res.status(400).json({ error: "Missing access token" });
    return;
  }

  try {
    const octokit = new Octokit({ auth: accessToken });
    const ghChanges: {
      message: string;
      files?: {
        [path: string]: {
          contents: string;
          mode?: string;
          type?: string;
        };
      };
      filesToDelete?: string[];
      ignoreDeletionFailures?: boolean;
    }[] = [];
    const ghChangesFiles: {
      [path: string]: {
        contents: string;
        mode?: string;
        type?: string;
      };
    } = {};
    const ghFilesToDelete: string[] = [];
    for (const ch of changes) {
      if (ch.type === 'added' || ch.type === 'modified') {
        if (!ch.content) {
          res.status(400).json({ error: "Missing content for added or modified file" });
          return;
        }
        ghChangesFiles[ch.path] = {
          contents: ch.content
        };
      }
      else if (ch.type === 'removed') {
        ghFilesToDelete.push(ch.path);
      }
    }
    ghChanges.push({
      message: 'jpfiddle commit',
      files: Object.keys(ghChangesFiles).length > 0 ? ghChangesFiles : undefined,
      filesToDelete: ghFilesToDelete.length > 0 ? ghFilesToDelete : undefined
    });
    await gitHubCreateOrUpdateFiles(
      octokit, {
        owner: repo.split('/')[0],
        repo: repo.split('/')[1],
        branch,
        changes: ghChanges,
        batchSize: 1,
        committer: {
          name: "jpfiddle",
          email: "jmagland@flatironinstitute.org"
        },
        author: {
          name: "jpfiddle",
          email: "jmagland@flatironinstitute.org"
        }
      }
    )
  }
  catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  res.status(200).json({
    success: true
  });
});
