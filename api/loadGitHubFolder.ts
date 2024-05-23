/* eslint-disable @typescript-eslint/no-explicit-any */
import allowCors from "../apiHelpers/allowCors";
import { GitHubFolder, isLoadGitHubFolderRequest } from "../apiHelpers/types";

export default allowCors(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const rr = req.body;
  if (!isLoadGitHubFolderRequest(rr)) {
    console.warn("Invalid request", rr);
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { repo, folderPath, branch } = rr;
  const accessToken = req.headers.authorization?.split(" ")[1]; // Extract the token

  if (!accessToken) {
    // TODO: use default access token - a token for the app - so that we get a
    // rate limit of 5000 req/hr for the api
  }

  const {folder: ff, rateLimitRemaining} = await loadFolderFromGitHub({
    repo,
    folderPath,
    branch,
    accessToken
  });

  res.status(200).json({
    folder: ff,
    rateLimitRemaining
  });
});

// important to use a folder cache because we are rate limited by GitHub
const folderMemoryCache = new Map<string, {
  folder: GitHubFolder;
  expires: number;
  // todo: keep track of last commit hash so that we can use the rss feed to figure out when to invalidate the cache
}>();

const loadFolderFromGitHub = async ({ repo, folderPath, branch, accessToken }: { repo: string; folderPath: string; branch: string; accessToken?: string }) => {
  const url = `https://api.github.com/repos/${repo}/contents/${folderPath}?ref=${branch}`;
  if (folderMemoryCache.has(url)) {
    const cached = folderMemoryCache.get(url);
    if (cached && cached.expires > Date.now()) {
      return {folder: cached.folder, rateLimitRemaining: undefined};
    }
  }
  const response = await fetch(url, {
    headers: accessToken ? {
      Authorization: `token ${accessToken}`
    } : undefined
  });
  if (!response.ok) {
    throw new Error(`Failed to load folder from GitHub: ${response.status} ${response.statusText}`);
  }
  const responseHeaders = response.headers;
  const rateLimitRemaining = responseHeaders.get('X-RateLimit-Remaining');
  const data = await response.json();
  const folderData = data as GitHubFolder;
  folderMemoryCache.set(url, {
    folder: folderData,
    expires: Date.now() + 60 * 1000 // 1 minutes for memory cache
  });
  return {folder: folderData, rateLimitRemaining};
}