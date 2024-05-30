/* eslint-disable @typescript-eslint/no-explicit-any */
import { useWindowDimensions } from "@fi-sci/misc";
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react";
import LeftPanel, { JSONStringifyDeterministic } from "./LeftPanel";
import TopBar from "./TopBar";
import { initialJupyterlabSelection } from "./jupyterlabSelection";
import useRoute from "./useRoute";
import SetupJpfiddle from "./JpfiddleContext/SetupJpfiddle";
import { useJpfiddle } from "./JpfiddleContext/JpfiddleContext";
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

const HomePage: FunctionComponent<Props> = () => {
  const { route } = useRoute()
  if (route.page !== 'home') {
    throw Error('Unexpected')
  }
  const { fiddleUri } = route
  const useLocalStorageForLocalFiles = initialJupyterlabSelection.type === 'jupyterlite'
  return (
    <SetupJpfiddle
      fiddleUri={fiddleUri || ''}
      apiBaseUrl=""
      useLocalStorageForLocalFiles={useLocalStorageForLocalFiles}
    >
      <HomePageChild />
    </SetupJpfiddle>
  )
}

const HomePageChild: FunctionComponent = () => {
  const { fiddleUri, fiddleId, cloudFiddle, initialLocalFiles, localFiles, setLocalFiles, changeLocalFile, deleteLocalFile, renameLocalFile, saveToCloud, saveAsGist, updateGist, saveAsGistMessage, resetFromCloud } = useJpfiddle()

  const [iframeElmt, setIframeElmt] = useState<HTMLIFrameElement | null>(null)

  // it seems we need to increment the ready code here
  // so that we can reset the useEffect hooks when we get a new ready message
  // in case the extension loaded and then reloaded (don't fully understand)
  const [jpfiddleExtensionReady, setJpfiddleExtensionReady] = useState(0)

  const { width, height } = useWindowDimensions()
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
        if (initialJupyterlabSelection.type !== 'jupyterlite') {
          iframeElmt.contentWindow?.postMessage({
            type: 'get-files'
          }, '*')
        }
      }
      else if (msg.type === 'file-saved') {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)
        changeLocalFile(msg.path, content)
      }
      else if (msg.type === 'file-renamed') {
        renameLocalFile(msg.oldPath, msg.newPath)
      }
      else if (msg.type === 'file-deleted') {
        deleteLocalFile(msg.path)
      }
      else if (msg.type === 'file-created') {
        changeLocalFile(msg.path, '')
      }
      else if (msg.type === 'files') {
        console.info('Received files', msg.files)
        if (msg.files === null) {
          setLocalFiles(null)
          return
        }
        const files: { path: string, content: string }[] = []
        for (const f of msg.files) {
          const textContent = typeof f.content === 'string' ? f.content : JSONStringifyDeterministic(f.content, 2)
          files.push({ path: f.path, content: textContent })
        }
        const files2: { [key: string]: string } = {}
        for (const f of files) {
          files2[f.path] = f.content
        }
        setLocalFiles(files2)
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      canceled = true
      window.removeEventListener('message', onMessage)
    }
  }, [iframeElmt, fiddleId, setLocalFiles, changeLocalFile, deleteLocalFile, renameLocalFile])

  useEffect(() => {
    if (!iframeElmt) return
    if (!jpfiddleExtensionReady) return
    if (!initialLocalFiles) return
    iframeElmt.contentWindow?.postMessage({
      type: 'set-files',
      files: initialLocalFiles
    }, '*')
  }, [initialLocalFiles, iframeElmt, jpfiddleExtensionReady])

  const { route, setRoute } = useRoute()
  if (route.page !== 'home') {
    throw Error('Unexpected')
  }

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

  const handleResetToCloudVersion = useCallback(async () => {
    if (!iframeElmt) return
    if (!jpfiddleExtensionReady) return
    const newFiles = await resetFromCloud()
    iframeElmt.contentWindow?.postMessage({
      type: 'set-files',
      files: newFiles
    }, '*')
  }, [iframeElmt, jpfiddleExtensionReady, resetFromCloud])

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
          localEditedFiles={localFiles || undefined}
          cloudFiddle={cloudFiddle}
          onSaveChangesToCloud={saveToCloud}
          onSaveAsGist={saveAsGist}
          onUpdateGist={updateGist}
          saveAsGistMessage={saveAsGistMessage}
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

export default HomePage;
