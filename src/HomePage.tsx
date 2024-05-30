/* eslint-disable @typescript-eslint/no-explicit-any */
import { useWindowDimensions } from "@fi-sci/misc";
import { FunctionComponent, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import LeftPanel, { JSONStringifyDeterministic } from "./LeftPanel";
import TopBar from "./TopBar";
import { Fiddle } from './types';
import useRoute from "./useRoute";
import ReferenceFileSystemClient from "./ReferenceFileSystemClient";
import { initialJupyterlabSelection } from "./jupyterlabSelection";
// import { getGitHubAccessToken } from "./App";

type Props = {
  // none
};

// export type FiddleAction = {
//   type: 'set-fiddle'
//   fiddle: Fiddle
// } | {
//   type: 'file-changed'
//   path: string
//   content: string
// } | {
//   type: 'file-renamed'
//   oldPath: string
//   newPath: string
// } | {
//   type: 'file-deleted'
//   path: string
// } | {
//   type: 'file-created'
//   path: string
// } | {
//   type: 'set-title'
//   title: string
// } | {
//   type: 'set-files',
//   files: {path: string, content: string}[]
// }

// const fiddleReducer = (state: Fiddle | undefined, action: FiddleAction): Fiddle | undefined => {
//   if (action.type === 'set-fiddle') {
//     return action.fiddle
//   }
//   else if (action.type === 'file-changed') {
//     if (!state) return state
//     return {
//       ...state,
//       refs: {
//         ...state.refs,
//         [action.path]: action.content
//       }
//     }
//   }
//   else if (action.type === 'file-renamed') {
//     if (!state) return state
//     if (state.refs[action.newPath]) throw Error(`File already exists: ${action.newPath}`)
//     const newRefs = { ...state.refs }
//     delete newRefs[action.oldPath]
//     newRefs[action.newPath] = state.refs[action.oldPath]
//     return {
//       ...state,
//       refs: newRefs
//     }
//   }
//   else if (action.type === 'file-deleted') {
//     if (!state) return state
//     const newRefs = { ...state.refs }
//     delete newRefs[action.path]
//     return {
//       ...state,
//       refs: newRefs
//     }
//   }
//   else if (action.type === 'file-created') {
//     if (!state) return state
//     if (state.refs[action.path]) throw Error(`File already exists: ${action.path}`)
//     return {
//       ...state,
//       refs: {
//         ...state.refs,
//         [action.path]: ''
//       }
//     }
//   }
//   else if (action.type === 'set-title') {
//     if (!state) return state
//     return {
//       ...state,
//       jpfiddle: {
//         ...state.jpfiddle,
//         title: action.title
//       }
//     }
//   }
//   else if (action.type === 'set-files') {
//     if (!state) return state
//     const newRefs: { [key: string]: string } = {}
//     for (const file of action.files) {
//       newRefs[file.path] = file.content
//     }
//     return {
//       ...state,
//       refs: newRefs
//     }
//   }
//   else {
//     return state
//   }
// }

type LocalEditedFiles = {[key: string]: string} | undefined | null

type LocalEditedFilesAction = {
  type: 'set-files'
  files: {path: string, content: string}[] | null
} | {
  type: 'file-changed'
  path: string
  content: string
} | {
  type: 'file-deleted'
  path: string
} | {
  type: 'file-created'
  path: string
} | {
  type: 'file-renamed'
  oldPath: string
  newPath: string
}

const localEditedFilesReducer = (state: LocalEditedFiles, action: LocalEditedFilesAction) => {
  if (action.type === 'set-files') {
    if (action.files === null) return null
    const r: {[key: string]: string} = {}
    for (const f of action.files) {
      r[f.path] = f.content
    }
    return r
  }
  else if (action.type === 'file-changed') {
    return {
      ...state,
      [action.path]: action.content
    }
  }
  else if (action.type === 'file-deleted') {
    const newState = {...state}
    delete newState[action.path]
    return newState
  }
  else if (action.type === 'file-created') {
    return {
      ...state,
      [action.path]: ''
    }
  }
  else if (action.type === 'file-renamed') {
    const newState = {...state}
    newState[action.newPath] = (state || {})[action.oldPath]
    delete newState[action.oldPath]
    return newState
  }
  return state
}

const getLocalEditedFilesFromBrowserStorage = (fiddleUri: string | undefined): LocalEditedFiles | undefined => {
  const x = localStorage.getItem(`local-edited-files|${fiddleUri || '_'}`)
  if (!x) return undefined
  try {
    return JSON.parse(x)
  }
  catch (err) {
    console.warn('Problem parsing local-edited-files from browser storage', err)
    return undefined
  }
}

const setLocalEditedFilesInBrowserStorage = (fiddleUri: string | undefined, files: LocalEditedFiles) => {
  localStorage.setItem(`local-edited-files|${fiddleUri || '_'}`, JSON.stringify(files))
}

const clearLocalEditedFilesFromBrowserStorage = (fiddleUri: string | undefined) => {
  localStorage.removeItem(`local-edited-files|${fiddleUri || '_'}`)
}

const HomePage: FunctionComponent<Props> = () => {
  const { route, setRoute } = useRoute()
  if (route.page !== 'home') {
    throw Error('Unexpected')
  }
  const { fiddleUri } = route
  const [cloudFiddle, setCloudFiddle] = useState<Fiddle | undefined>(undefined)
  const [localEditedFiles, localEditedFilesDispatch] = useReducer(localEditedFilesReducer, undefined)
  useEffect(() => {
    // prior to leaving page
    if (initialJupyterlabSelection.type !== 'jupyterlite') return
    if (!localEditedFiles) return
    const onUnload = () => {
      if (!localEditedFiles) return
      setLocalEditedFilesInBrowserStorage(fiddleUri, localEditedFiles)
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [fiddleUri, localEditedFiles])
  const [iframeElmt, setIframeElmt] = useState<HTMLIFrameElement | null>(null)

  // it seems we need to increment the ready code here
  // so that we can reset the useEffect hooks when we get a new ready message
  // in case the extension loaded and then reloaded (don't fully understand)
  const [jpfiddleExtensionReady, setJpfiddleExtensionReady] = useState(0)

  const { width, height } = useWindowDimensions()
  const fiddleId = useMemo(() => {
    if (!fiddleUri) return 'unsaved'
    return (fiddleUri.split('/').slice(-1)[0] || '').split('.')[0] || 'unknown'
  }, [fiddleUri])
  useEffect(() => {
    if (!iframeElmt) return
    if (!fiddleId) return
    let canceled = false
    const onMessage = (e: MessageEvent) => {
      if (canceled) {
        console.warn('Ignoring message because canceled', e.data)
        return
      }
      const msg = e.data
      console.info('Received message', msg)
      if (msg.type === 'jpfiddle-extension-ready') {
        console.info('jpfiddle extension ready *****')
        setJpfiddleExtensionReady(c => c + 1)
        iframeElmt.contentWindow?.postMessage({
          type: 'set-fiddle-id',
          // see https://github.com/jupyterlite/jupyterlite/issues/1399
          // for now, we need to avoid subfolders for firefox, sadly
          fiddleId: initialJupyterlabSelection.type === 'jupyterlite' ? '' : fiddleId
        }, '*')
        iframeElmt.contentWindow?.postMessage({
          type: 'get-files'
        }, '*')
      }
      else if (msg.type === 'file-saved') {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)
        localEditedFilesDispatch({type: 'file-changed', path: msg.path, content})
      }
      else if (msg.type === 'file-renamed') {
        localEditedFilesDispatch({ type: 'file-renamed', oldPath: msg.oldPath, newPath: msg.newPath })
      }
      else if (msg.type === 'file-deleted') {
        localEditedFilesDispatch({ type: 'file-deleted', path: msg.path })
      }
      else if (msg.type === 'file-created') {
        localEditedFilesDispatch({ type: 'file-created', path: msg.path })
      }
      else if (msg.type === 'files') {
        console.info('Received files', msg.files)
        if (msg.files === null) {
          localEditedFilesDispatch({ type: 'set-files', files: null })
          return
        }
        const files: {path: string, content: string}[] = []
        for (const f of msg.files) {
          const textContent = typeof f.content === 'string' ? f.content : JSONStringifyDeterministic(f.content)
          files.push({path: f.path, content: textContent})
        }
        localEditedFilesDispatch({ type: 'set-files', files })
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      canceled = true
      window.removeEventListener('message', onMessage)
    }
  }, [iframeElmt, fiddleId])
  useEffect(() => {
    let canceled = false
    setCloudFiddle(undefined)
    if (!fiddleUri) {
      setCloudFiddle({
        jpfiddle: {
          title: 'Untitled'
        },
        refs: {}
      })
      return
    }
    (async () => {
      const response = await fetch(fiddleUri)
      if (!response.ok) throw Error(`Unable to load fiddle from cloud: ${fiddleUri}`)
      const fiddle: Fiddle = await response.json()
      if (canceled) return
      setCloudFiddle(fiddle)
    })()
    return () => {
      canceled = true
    }
  }, [fiddleUri])
  useEffect(() => {
    let canceled = false
    if (localEditedFiles === undefined) return
    if (!cloudFiddle) return
    if (!iframeElmt) return
    if (!jpfiddleExtensionReady) return
    ; (async () => {
      if (localEditedFiles === null) {
        if (initialJupyterlabSelection.type === 'jupyterlite') {
          const x = getLocalEditedFilesFromBrowserStorage(fiddleUri)
          if (x) {
            const files: {path: string, content: string}[] = []
            for (const fname in x) {
              files.push({path: fname, content: x[fname]})
            }
            iframeElmt.contentWindow?.postMessage({
              type: 'set-files',
              files
            }, '*')
            return
          }
        }
        const cloudFiddleClient = new ReferenceFileSystemClient({
          version: 0,
          refs: cloudFiddle.refs
        })
        const filesToSet = []
        for (const fname in cloudFiddle.refs) {
          const buf = await cloudFiddleClient.readBinary(fname, {})
          if (canceled) return
          const content = new TextDecoder().decode(buf)
          filesToSet.push({path: fname, content})
        }
        iframeElmt.contentWindow?.postMessage({
          type: 'set-files',
          files: filesToSet
        }, '*')
      }
    })()
    return () => { canceled = true }
  }, [cloudFiddle, localEditedFiles, iframeElmt, jpfiddleExtensionReady, fiddleUri])
  useEffect(() => {
    // update the title in the route
    if (!cloudFiddle) return
    if (!cloudFiddle.jpfiddle) return
    if (!cloudFiddle.jpfiddle.title) return
    if (cloudFiddle.jpfiddle.title === route.title) return
    const newRoute = { ...route, title: cloudFiddle.jpfiddle.title }
    setRoute(newRoute, { replace: true })
  }, [cloudFiddle, route, setRoute])

  useEffect(() => {
    // update the document title based on the route
    if (!route.title) {
      document.title = 'jpfiddle'
    }
    else {
      document.title = route.title
    }
  }, [route.title])
  // useEffect(() => {
  //   let canceled = false
  //   if (!cloudFiddle) return
  //     ; (async () => {
  //       const x = await getLocalEditedFiddleForUri(fiddleUri)
  //       if (canceled) return
  //       if (!x) {
  //         localEditedFiddleDispatch({ type: 'set-fiddle', fiddle: cloudFiddle })
  //       }
  //       else {
  //         localEditedFiddleDispatch({ type: 'set-fiddle', fiddle: x })
  //       }
  //     })()
  //   return () => {
  //     canceled = true
  //   }
  // }, [cloudFiddle, fiddleUri])
  // useEffect(() => {
  //   if (!localEditedFiddle) return
  //     ; (async () => {
  //       await setLocalEditedFiddleForUri(fiddleUri, localEditedFiddle)
  //     })()
  // }, [localEditedFiddle, fiddleUri])
  // const [fiddleFilesOnIframeHaveBeenSet, setFiddleFilesOnIframeHaveBeenSet] = useState(false)
  // const [loadFilesStatus, setLoadFilesStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  // useEffect(() => {
  //   if (!iframeElmt) return
  //   if (!jpfiddleExtensionReady) return
  //   if (!localEditedFiles) return
  //   if (fiddleFilesOnIframeHaveBeenSet) return
  //   setLoadFilesStatus('loading')
  //   let canceled = false
  //     ; (async () => {
  //       const files: { path: string, content: string }[] = []
  //       for (const fname in localEditedFiles) {
  //         const text = localEditedFiles[fname]
  //         if (canceled) return
  //         if (text) {
  //           files.push({
  //             path: fname,
  //             content: text
  //           })
  //         }
  //       }
  //       if (!iframeElmt.contentWindow) throw Error('Unexpected: iframeElmt.contentWindow is null')
  //       iframeElmt.contentWindow.postMessage({
  //         type: 'set-files',
  //         files
  //       }, '*')
  //       setFiddleFilesOnIframeHaveBeenSet(true)
  //       setLoadFilesStatus('loaded')
  //       return () => {
  //         canceled = true
  //       }
  //     })()
  // }, [iframeElmt, jpfiddleExtensionReady, localEditedFiles, fiddleFilesOnIframeHaveBeenSet])

  const handleToCloud = useCallback(async () => {
    if (!localEditedFiles) return
    const existingTitle = cloudFiddle?.jpfiddle?.title
    const title = window.prompt('Enter a title for this fiddle', formSuggestedNewTitle(existingTitle || ''))
    if (!title) return
    const userName = getUserName()
    if (!userName) return
    const newFiddle: Fiddle = {
      jpfiddle: {
        ...cloudFiddle?.jpfiddle,
        title,
        userName,
        previousFiddleUri: fiddleUri,
        timestamp: Date.now() / 1000
      },
      refs: localEditedFiles
    }
    const url = `/api/saveFiddle`
    const rr = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({fiddle: newFiddle})
    })
    if (!rr.ok) {
      alert(`Problem saving to cloud: ${await rr.text()}`)
      return
    }
    const resp = await rr.json()
    if (!resp.success) {
      alert(`Problem saving to cloud: ${resp.error}`)
      return
    }
    // localforage.removeItem(`local-fiddle|${fiddleUri}`)
    const newFiddleUri = resp.fiddleUri
    window.location.href = `/?f=${newFiddleUri}`
  }, [localEditedFiles, cloudFiddle, fiddleUri])

  const handleResetToCloudVersion = useCallback(async () => {
    if (!cloudFiddle) return
    if (!iframeElmt) throw Error('Unexpected: iframeElmt is null')
    const okay = window.confirm('Are you sure you want to discard local changes and reset to the cloud version?')
    if (!okay) return
    const cloudFiddleClient = new ReferenceFileSystemClient({
      version: 0,
      refs: cloudFiddle.refs
    })
    const newFiles = []
    for (const fname in cloudFiddle.refs) {
      const buf = await cloudFiddleClient.readBinary(fname, {})
      const content = new TextDecoder().decode(buf)
      newFiles.push({path: fname, content})
    }
    for (const fname in localEditedFiles || {}) {
      if (!cloudFiddle.refs[fname]) {
        newFiles.push({path: fname, content: null})
      }
    }
    iframeElmt.contentWindow?.postMessage({
      type: 'set-files',
      files: newFiles
    }, '*')
    clearLocalEditedFilesFromBrowserStorage(fiddleUri)
  }, [cloudFiddle, localEditedFiles, iframeElmt, fiddleUri])

  const topBarHeight = 40
  const leftPanelWidth = Math.max(250, Math.min(340, width * 0.2))

  const jupyterlabSrc = useMemo(() => {
    // ?reset is used so we don't reopen tabs - which is important when switching between fiddles
    let u: string
    if (initialJupyterlabSelection.type === 'jupyterlite') {
      u = 'https://magland.github.io/jpfiddle-jupyterlite/lab'
    }
    else if (initialJupyterlabSelection.type === 'local') {
      u = initialJupyterlabSelection.url
    }
    else {
      // default to jupyterlite
      u = 'https://magland.github.io/jpfiddle-jupyterlite/lab'
    }
    return u + (u.includes('?') ? '&' : '?') + 'reset'
  }, [])

  return (
    <div style={{ position: 'absolute', width, height, overflow: 'hidden' }}>
      <div className="jpfiddle-top-bar" style={{ position: 'absolute', left: 0, top: 0, width, height: topBarHeight, overflow: 'hidden' }}>
        <TopBar
          width={width}
          height={topBarHeight}
          cloudFiddle={cloudFiddle}
          fiddleUri={fiddleUri}
        />
      </div>
      <div className="jpfiddle-left-panel" style={{ position: 'absolute', left: 0, top: topBarHeight, width: leftPanelWidth, height: height - topBarHeight, overflow: 'auto' }}>
        <LeftPanel
          width={leftPanelWidth}
          height={height - topBarHeight}
          fiddleUri={fiddleUri || ''}
          fiddleId={fiddleId}
          localEditedFiles={localEditedFiles || undefined}
          cloudFiddle={cloudFiddle}
          onSaveChangesToCloud={handleToCloud}
          onResetToCloudVersion={handleResetToCloudVersion}
          loadFilesStatus={'loaded'}
        />
      </div>
      <div className="jupyter-window" style={{ position: 'absolute', left: leftPanelWidth, top: topBarHeight, width: width - leftPanelWidth, height: height - topBarHeight, overflow: 'hidden' }}>
        <iframe
          ref={elmt => setIframeElmt(elmt)}
          style={{ width: '100%', height: '100%' }}
          src={jupyterlabSrc}
        />
      </div>
    </div>
  )
};

// const getLocalEditedFiddleForUri = async (fiddleUri: string | undefined): Promise<Fiddle | undefined> => {
//   const x = await localforage.getItem(`local-fiddle|${fiddleUri}`)
//   if (!x) return undefined
//   return x as Fiddle
// }

// const setLocalEditedFiddleForUri = async (fiddleUri: string | undefined, fiddle: Fiddle) => {
//   await localforage.setItem(`local-fiddle|${fiddleUri}`, fiddle)
// }

const formSuggestedNewTitle = (existingTitle: string): string => {
  if (!existingTitle) return ''
  // if it's old-title, we want to make it old-title v2
  // if it's old-title v2, we want to make it old-title v3
  // etc
  if (existingTitle === 'Untitled') return existingTitle
  const match = existingTitle.match(/(.*) v(\d+)$/)
  if (!match) return `${existingTitle} v2`
  const base = match[1]
  const num = parseInt(match[2])
  return `${base} v${num + 1}`
}

const getUserName = (): string | null => {
  const userNameFromLocalStorage = localStorage.getItem('jpfiddle-user-name')
  const msg = 'Enter your full name. This is needed so we can delete large suspicious fiddles.'
  const name = window.prompt(msg, userNameFromLocalStorage || '')
  if (!name) return null
  localStorage.setItem('jpfiddle-user-name', name)
  return name
}

export default HomePage;
