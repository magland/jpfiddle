import { isNumber, isString, optional, validateObject } from "@fi-sci/misc"

/* eslint-disable @typescript-eslint/no-explicit-any */
export type LoadGitHubFolderRequest = {
  repo: string
  folderPath: string
  branch: string
}

export const isLoadGitHubFolderRequest = (x: any): x is LoadGitHubFolderRequest => {
  return x && typeof x.repo === "string" && typeof x.folderPath === "string" && typeof x.branch === "string";
}

export type GitHubFolder = {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | any;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}[]

export type LoadGitHubFileRequest = {
  repo: string
  filePath: string
  branch: string
}

export const isLoadGitHubFileRequest = (x: any): x is LoadGitHubFileRequest => {
  return x && typeof x.repo === "string" && typeof x.filePath === "string" && typeof x.branch === "string";
}

export type GitHubFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | any;
  content: string; // base64 encoded
  encoding: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

export type FileChange = {
  type: 'modified' | 'added' | 'removed';
  path: string;
  content?: string;
}

export type CommitGitHubChangesRequest = {
  repo: string;
  branch: string;
  changes: FileChange[];
}