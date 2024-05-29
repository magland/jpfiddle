/* eslint-disable @typescript-eslint/no-explicit-any */
import { useWindowDimensions } from "@fi-sci/misc";
import { FunctionComponent, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import LeftPanel, { JSONStringifyDeterministic } from "./LeftPanel";
import TopBar from "./TopBar";
import { Fiddle } from './types';
import useRoute from "./useRoute";
import ReferenceFileSystemClient from "./ReferenceFileSystemClient";
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

const HomePage: FunctionComponent<Props> = () => {
  const { route } = useRoute()
  if (route.page !== 'home') {
    throw Error('Unexpected')
  }
  const { fiddleUri } = route
  const [cloudFiddle, setCloudFiddle] = useState<Fiddle | undefined>(undefined)
  const [localEditedFiles, localEditedFilesDispatch] = useReducer(localEditedFilesReducer, undefined)
  const [iframeElmt, setIframeElmt] = useState<HTMLIFrameElement | null>(null)
  const [jpfiddleExtensionReady, setJpfiddleExtensionReady] = useState(false)
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
        setJpfiddleExtensionReady(true)
        iframeElmt.contentWindow?.postMessage({
          type: 'set-fiddle-id',
          fiddleId
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
  }, [cloudFiddle, localEditedFiles, iframeElmt, jpfiddleExtensionReady])
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
    const newFiddle: Fiddle = {
      jpfiddle: {
        ...cloudFiddle?.jpfiddle,
        title,
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
  }, [cloudFiddle, localEditedFiles, iframeElmt])

  const topBarHeight = 40
  const leftPanelWidth = Math.max(250, Math.min(340, width * 0.2))

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
          // src="https://magland.github.io/jpfiddle-jupyterlite/lab/index.html"
          // reset is used so we don't reopen tabs - which is important when switching between fiddles
          src="http://localhost:8888/lab?reset"
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
  const match = existingTitle.match(/(.*) v(\d+)$/)
  if (!match) return `${existingTitle} v2`
  const base = match[1]
  const num = parseInt(match[2])
  return `${base} v${num + 1}`
}

export default HomePage;
