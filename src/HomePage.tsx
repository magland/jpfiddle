/* eslint-disable @typescript-eslint/no-explicit-any */
import { FunctionComponent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import LoginButton from "./LoginButton";
import { CommitGitHubChangesRequest, FileChange, GitHubFile, GitHubFolder, LoadGitHubFileRequest, LoadGitHubFolderRequest } from "./types";
import localforage from "localforage";
import { Hyperlink } from "@fi-sci/misc";
// import { getGitHubAccessToken } from "./App";

type Props = {
  folderUrl?: string
};

type JPFiddleFile = {
  path: string;
  content: string;
}

type EditedFiles = JPFiddleFile[] | undefined

type EditedFilesAction = {
  type: 'set-files';
  files: EditedFiles;
} | {
  type: 'file-changed';
  path: string;
  content: string;
} | {
  type: 'file-renamed';
  oldPath: string;
  newPath: string;
} | {
  type: 'file-deleted';
  path: string;
} | {
  type: 'file-created';
  path: string;
}

const editedFilesReducer = (state: EditedFiles, action: EditedFilesAction): EditedFiles => {
  switch (action.type) {
    case 'set-files':
      return action.files
    case 'file-changed':
      if ((state || []).find(f => f.path === action.path)) {
        return (state || []).map(f => {
          if (f.path === action.path) {
            return {
              ...f,
              content: action.content
            }
          }
          return f
        })
      }
      else {
        return (state || []).concat({
          path: action.path,
          content: action.content
        })
      }
    case 'file-renamed':
      return (state || []).map(f => {
        if (f.path === action.oldPath) {
          return {
            ...f,
            path: action.newPath
          }
        }
        return f
      })
    case 'file-deleted':
      return (state || []).filter(f => f.path !== action.path)
    case 'file-created':
      if ((state || []).find(f => f.path === action.path)) {
        return state
      }
      return (state || []).concat({
        path: action.path,
        content: ''
      })
  }
}

const HomePage: FunctionComponent<Props> = ({folderUrl}) => {
  const [savedFiles, setSavedFiles] = useState<JPFiddleFile[] | undefined>(undefined)
  const [editedFiles, editedFilesDispatch] = useReducer(editedFilesReducer, undefined)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data
      console.info('Received message', msg)
      if (msg.type === 'file-saved') {
        // for notebooks, content is an object
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)
        editedFilesDispatch({type: 'file-changed', path: msg.path, content})
      }
      else if (msg.type === 'file-renamed') {
        editedFilesDispatch({type: 'file-renamed', oldPath: msg.oldPath, newPath: msg.newPath})
      }
      else if (msg.type === 'file-deleted') {
        editedFilesDispatch({type: 'file-deleted', path: msg.path})
      }
      else if (msg.type === 'file-created') {
        editedFilesDispatch({type: 'file-created', path: msg.path})
      }
    }
    window.addEventListener('message', onMessage)
    ;(async () => {
      const editedFiles0: JPFiddleFile[] = []
      const {repo, folderPath, branch} = parseGitHubFolderUrl(folderUrl)
      let canceled = false
      const ff = await loadGitHubFolder({repo, folderPath, branch})
      if (canceled) {
        return
      }
      for (const f of ff) {
        if (f.type === 'file') {
          const file = await loadGitHubFile({repo, filePath: f.path, branch})
          if (canceled) {
            return
          }
          const content = atob(file.content)
          editedFiles0.push({
            path: f.path.slice(folderPath.length + 1),
            content
          })
        }
      }
      editedFilesDispatch({type: 'set-files', files: editedFiles0})
      setSavedFiles(deepCopy(editedFiles0))
      iframeRef.current?.contentWindow?.postMessage({
        type: 'set-files',
        files: editedFiles0
      }, '*')
      return () => {
        canceled = true
        window.removeEventListener('message', onMessage)
      }
    })()
  }, [folderUrl])

  const addedFilePaths = useMemo(() => {
    const added: string[] = []
    for (const f of editedFiles || []) {
      if (!savedFiles?.find(f0 => f0.path === f.path)) {
        added.push(f.path)
      }
    }
    return added
  }, [editedFiles, savedFiles])

  const removedFilePaths = useMemo(() => {
    const removed: string[] = []
    for (const f of savedFiles || []) {
      if (!editedFiles?.find(f0 => f0.path === f.path)) {
        removed.push(f.path)
      }
    }
    return removed
  }, [editedFiles, savedFiles])

  const modifiedFilePaths = useMemo(() => {
    const modified: string[] = []
    for (const f of editedFiles || []) {
      if (savedFiles?.find(f0 => f0.path === f.path && f0.content !== f.content)) {
        modified.push(f.path)
      }
    }
    return modified
  }, [editedFiles, savedFiles])

  const hasChanges = useMemo(() => {
    return addedFilePaths.length > 0 || removedFilePaths.length > 0 || modifiedFilePaths.length > 0
  }, [addedFilePaths, removedFilePaths, modifiedFilePaths])

  const handleCommitChanges = useCallback(async () => {
    const {repo, folderPath, branch} = parseGitHubFolderUrl(folderUrl)
    const modifiedChanges = modifiedFilePaths.map(path => {
      const file = editedFiles?.find(f => f.path === path)
      if (!file) {
        throw new Error(`File not found: ${path}`)
      }
      return {
        type: 'modified',
        path: folderPath + '/' + path,
        content: file.content
      } as FileChange
    });
    const addedChanges = addedFilePaths.map(path => {
      const file = editedFiles?.find(f => f.path === path)
      if (!file) {
        throw new Error(`File not found: ${path}`)
      }
      return {
        type: 'added',
        path: folderPath + '/' + path,
        content: file.content
      } as FileChange
    });
    const removedChanges = removedFilePaths.map(path => {
      return {
        type: 'removed',
        path: folderPath + '/' + path
      } as FileChange
    });
    const url = `/api/commitGitHubChanges`
    const githubAccessTokenJson = localStorage.getItem('github_access_token')
    if (!githubAccessTokenJson) {
      throw new Error('No github access token')
    }
    let githubAccessToken
    try {
      githubAccessToken = JSON.parse(githubAccessTokenJson).accessToken
      if (!githubAccessToken) {
        throw new Error('No github access token')
      }
    }
    catch (e) {
      throw new Error(`Invalid github access token json: ${githubAccessTokenJson}`)
    }
    const changes: FileChange[] = modifiedChanges.concat(addedChanges).concat(removedChanges)
    const req: CommitGitHubChangesRequest = {
      repo,
      branch,
      changes
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${githubAccessToken}`
      },
      body: JSON.stringify(req)
    })
    if (!response.ok) {
      throw new Error(`Failed to commit changes: ${response.statusText}`)
    }
    const data = await response.json()
    if (!data.success) {
      throw new Error(`Failed to commit changes`)
    }
    console.info('Changes committed successfully')
  }, [addedFilePaths, editedFiles, modifiedFilePaths, removedFilePaths, folderUrl])

  return (
    <div>
      <div>
        <h3>Log in using GitHub in order to use jpfiddle</h3>
        <LoginButton />
      </div>
      <div>
        {modifiedFilePaths.length > 0 && (
          <span>{modifiedFilePaths.length} modified&nbsp;&nbsp;&nbsp;</span>
        )}
        {addedFilePaths.length > 0 && (
          <span>{addedFilePaths.length} added&nbsp;&nbsp;&nbsp;</span>
        )}
        {removedFilePaths.length > 0 && (
          <span>{removedFilePaths.length} removed&nbsp;&nbsp;&nbsp;</span>
        )}
        {
          hasChanges && (
            <Hyperlink onClick={handleCommitChanges}>
              Commit changes
            </Hyperlink>
          )
        }
      </div>
      <div>
        <iframe
          ref={iframeRef}
          style={{width: 800, height: 800}}
          src="http://localhost:5000"
        />
      </div>
    </div>
  )
};

const parseGitHubFolderUrl = (url: string | undefined) => {
  // for example https://github.com/scratchrealm/jpfiddle_examples/tree/main/test1
  if (!url) {
    return {repo: '', folderPath: '', branch: ''}
  }
  const parts = url.split('/')
  if (parts.length < 6) {
    return {repo: '', folderPath: '', branch: ''}
  }
  const repo = parts[3] + '/' + parts[4]
  const branch = parts[6]
  const folderPath = parts.slice(7).join('/')
  return {repo, folderPath, branch}
}

const folderMemoryCache = new Map<string, {
  folder: GitHubFolder;
  expires: number;
}>();

const folderBrowserCache = localforage.createInstance({
  name: 'github-folder-cache'
})

const loadGitHubFolder = async ({repo, folderPath, branch}: {repo: string, folderPath: string, branch: string}): Promise<GitHubFolder> => {
  const k = `folder|${repo}|${branch}|${folderPath}`
  if (folderMemoryCache.has(k)) {
    const cached = folderMemoryCache.get(k)
    if (cached && cached.expires > Date.now()) {
      return cached.folder
    }
  }
  try {
    const cached: any = await folderBrowserCache.getItem(k)
    if (cached && (cached.expires > Date.now())) {
      return cached.folder
    }
  }
  catch (e) {
    console.error('Failed to get folder from localforage', e)
  }
  const req: LoadGitHubFolderRequest = {
    repo,
    folderPath,
    branch
  }
  const url = `/api/loadGitHubFolder`
  const githubAccessTokenJson = localStorage.getItem('github_access_token')
  if (!githubAccessTokenJson) {
    throw new Error('No github access token')
  }
  let githubAccessToken
  try {
    githubAccessToken = JSON.parse(githubAccessTokenJson).accessToken
    if (!githubAccessToken) {
      throw new Error('No github access token')
    }
  }
  catch (e) {
    throw new Error(`Invalid github access token json: ${githubAccessTokenJson}`)
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `token ${githubAccessToken}`
    },
    body: JSON.stringify(req)
  })
  if (!response.ok) {
    throw new Error(`Failed to load github folder: ${response.statusText}`)
  }
  const data = await response.json()
  const {folder: ff, rateLimitRemaining} = data
  if (rateLimitRemaining !== undefined) {
    console.info(`Rate limit remaining: ${rateLimitRemaining}`)
  }
  folderMemoryCache.set(k, {
    folder: ff,
    expires: Date.now() + 1000 * 60 * 60 // 1 hour for memory cache (user should reload the page)
  })
  await folderBrowserCache.setItem(k, {
    folder: ff,
    expires: Date.now() + 1 * 1000 * 60 // 1 minute - this is useful for rapid page reloads, esp during development
  })
  return ff as GitHubFolder
}

const fileMemoryCache = new Map<string, {
  file: GitHubFile;
  expires: number;
}>();

// fileBrowserCache uses localforage
const fileBrowserCache = localforage.createInstance({
  name: 'github-file-cache'
})

const loadGitHubFile = async ({repo, filePath, branch}: {repo: string, filePath: string, branch: string}) => {
  const k = `file|${repo}|${branch}|${filePath}`
  if (fileMemoryCache.has(k)) {
    const cached = fileMemoryCache.get(k)
    if (cached && cached.expires > Date.now()) {
      return cached.file
    }
  }
  try {
    const cached: any = await fileBrowserCache.getItem(k)
    if (cached && (cached.expires > Date.now())) {
      return cached.file
    }
  }
  catch (e) {
    console.error('Failed to get file from localforage', e)
  }
  const req: LoadGitHubFileRequest = {
    repo,
    filePath,
    branch
  }
  const url = `/api/loadGitHubFile`
  const githubAccessTokenJson = localStorage.getItem('github_access_token')
  if (!githubAccessTokenJson) {
    throw new Error('No github access token')
  }
  let githubAccessToken
  try {
    githubAccessToken = JSON.parse(githubAccessTokenJson).accessToken
    if (!githubAccessToken) {
      throw new Error('No github access token')
    }
  }
  catch (e) {
    throw new Error(`Invalid github access token json: ${githubAccessTokenJson}`)
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `token ${githubAccessToken}`
    },
    body: JSON.stringify(req)
  })
  if (!response.ok) {
    throw new Error(`Failed to load github file: ${response.statusText}`)
  }
  const data = await response.json()
  const {file: ff, rateLimitRemaining} = data
  if (rateLimitRemaining !== undefined) {
    console.info(`Rate limit remaining: ${rateLimitRemaining}`)
  }
  fileMemoryCache.set(k, {
    file: ff,
    expires: Date.now() + 1000 * 60 * 60 // 1 hour for memory cache (user should reload the page)
  })
  await fileBrowserCache.setItem(k, {
    file: ff,
    expires: Date.now() + 1 * 1000 * 60 // 1 minute - this is useful for rapid page reloads, esp during development
  })
  return ff as GitHubFile
}

const deepCopy = (obj: any) => {
  return JSON.parse(JSON.stringify(obj))
}

export default HomePage;
