/* eslint-disable @typescript-eslint/no-explicit-any */
import allowCors from "../apiHelpers/allowCors";
import { GitHubFile, isLoadGitHubFileRequest } from "../apiHelpers/types";

export default allowCors(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const rr = req.body;
  if (!isLoadGitHubFileRequest(rr)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { repo, filePath, branch } = rr;
  const accessToken = req.headers.authorization?.split(" ")[1]; // Extract the token

  if (!accessToken) {
    // TODO: use default access token - a token for the app - so that we get a
    // rate limit of 5000 req/hr for the api
  }

  const {file: ff, rateLimitRemaining} = await loadFileFromGitHub({
    repo,
    filePath,
    branch,
    accessToken
  });

  res.status(200).json({
    file: ff,
    rateLimitRemaining
  });
});

const fileCache = new Map<string, {
  file: GitHubFile;
  expires: number;
}>()

const loadFileFromGitHub = async ({ repo, filePath, branch, accessToken }: { repo: string; filePath: string; branch: string; accessToken?: string }) => {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
  if (fileCache.has(url)) {
    const cached = fileCache.get(url);
    if (cached && cached.expires > Date.now()) {
      return {
        file: cached.file,
        rateLimitRemaining: undefined
      }
    }
  }
  const response = await fetch(url, {
    headers: accessToken ? {
      Authorization: `token ${accessToken}`
    } : undefined
  });
  if (!response.ok) {
    throw new Error(`Failed to load file from GitHub: ${response.status} ${response.statusText}`);
  }
  const responseHeaders = response.headers;
  const rateLimitRemaining = responseHeaders.get('X-RateLimit-Remaining');
  const data = await response.json();
  const fileData = data as GitHubFile;
  fileCache.set(url, {
    file: fileData,
    expires: Date.now() + 60 * 1000
  });
  return {
    file: fileData,
    rateLimitRemaining
  };
}