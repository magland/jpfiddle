/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hyperlink } from "@fi-sci/misc";
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react";
import { Fiddle } from './types';

type LeftPanelProps = {
    width: number
    height: number
    fiddleUri: string
    cloudFiddle: Fiddle | undefined
    localEditedFiles?: {[key: string]: string}
    onSaveChangesToCloud: () => void
    onResetToCloudVersion: () => void
    loadFilesStatus: 'loading' | 'loaded' | 'error'
}

const LeftPanel: FunctionComponent<LeftPanelProps> = ({ width, fiddleUri, cloudFiddle, localEditedFiles, onSaveChangesToCloud, onResetToCloudVersion, loadFilesStatus }) => {
    const addedFilePaths: string[] = useMemo(() => {
        if (!localEditedFiles) return []
        if (!cloudFiddle) return []
        const added: string[] = []
        for (const pp in localEditedFiles) {
            if (!(pp in cloudFiddle.refs)) {
                added.push(pp)
            }
        }
        return added
    }, [localEditedFiles, cloudFiddle])

    const removedFilePaths: string[] = useMemo(() => {
        if (!cloudFiddle) return []
        if (!localEditedFiles) return []
        const removed: string[] = []
        for (const pp in cloudFiddle.refs) {
            if (!(pp in localEditedFiles)) {
                removed.push(pp)
            }
        }
        return removed
    }, [localEditedFiles, cloudFiddle])

    const modifiedFilePaths: string[] = useMemo(() => {
        if (!cloudFiddle) return []
        if (!localEditedFiles) return []

        const modified: string[] = []
        for (const pp in localEditedFiles) {
            if (cloudFiddle.refs[pp]) {
                if (!refsAreEqual(cloudFiddle.refs[pp], localEditedFiles[pp])) {
                    modified.push(pp)
                }
            }
        }
        return modified
    }, [localEditedFiles, cloudFiddle])

    const hasChanges = useMemo(() => {
        return addedFilePaths.length > 0 || removedFilePaths.length > 0 || modifiedFilePaths.length > 0
    }, [addedFilePaths, removedFilePaths, modifiedFilePaths])

    const metaSection = (
        <div style={{ position: 'relative', left: 2, width: width - 4 }}>
        </div>
    )
    let loadingStatusSection: any | undefined = undefined
    if ((fiddleUri && (!cloudFiddle)) || (loadFilesStatus !== 'loaded')) {
        loadingStatusSection = (
            <div>
                {fiddleUri && (!cloudFiddle) ? (
                    <div>
                        Loading {fiddleUri}
                    </div>
                ) : <div>Loaded</div>}
                {loadFilesStatus === 'loading' && (
                    <div>
                        Loading files...
                    </div>
                )}
            </div>
        )
    }
    const localChangesSection = (
        hasChanges && (
            <div>
                <h3>Local changes</h3>
                <ul>
                    {
                        addedFilePaths.map((path, ii) => (
                            <li key={ii}>
                                {path} - added
                            </li>
                        ))
                    }
                    {
                        removedFilePaths.map((path, ii) => (
                            <li key={ii}>
                                {path} - removed
                            </li>
                        ))
                    }
                    {
                        modifiedFilePaths.map((path, ii) => (
                            <li key={ii}>
                                {path} - modified
                            </li>
                        ))
                    }
                </ul>
                <div>
                    <Hyperlink onClick={onSaveChangesToCloud}>
                        Save to cloud
                    </Hyperlink>
                </div>
                <div>
                    <Hyperlink onClick={onResetToCloudVersion}>
                        Reset to cloud version
                    </Hyperlink>
                </div>
            </div>
        )
    )

    const { recentFiddles, addRecentFiddle } = useRecentFiddles()
    const cloudFiddleTitle = useMemo(() => cloudFiddle?.jpfiddle.title, [cloudFiddle])
    useEffect(() => {
        if ((fiddleUri) && (cloudFiddleTitle)) {
            addRecentFiddle(cloudFiddleTitle, fiddleUri)
        }
    }, [fiddleUri, cloudFiddleTitle, addRecentFiddle])

    const recentFiddlesSection = (
        <div style={{ position: 'relative', height: 150, overflowY: 'auto'}}>
            <span style={{ fontSize: 16, fontWeight: 'bold' }}>Recent</span>
            {
                recentFiddles.filter(rf => rf.url !== fiddleUri).map((rf, ii) => (
                    <div key={ii}>
                        <Hyperlink onClick={() => {
                            window.location.href = `/?f=${rf.url}`
                        }}>
                            {rf.title}
                        </Hyperlink>
                    </div>
                ))
            }
        </div>
    )

    const previousVersionSection = (
        cloudFiddle?.jpfiddle.previousFiddleUri && (
            <div>
                <Hyperlink onClick={() => {
                    window.location.href = `/?f=${cloudFiddle.jpfiddle.previousFiddleUri}`
                }}>
                    Previous version
                </Hyperlink>
            </div>
        )
    )

    const temporyWarningSection = (
        fiddleUri.startsWith('https://tempory.net') && (
            <div style={{ color: 'darkorange' }}>
                Warning: Files stored on tempory.net are temporary and subject to deletion.
            </div>
        )
    )

    {/* <div>
        <h3>Log in using GitHub in order to use jpfiddle</h3>
        <LoginButton />
      </div> */}

    return (
        <div>
            {metaSection}
            <hr />
            {loadingStatusSection}
            {loadingStatusSection && <hr />}

            {localChangesSection}
            {localChangesSection && <hr />}

            {recentFiddlesSection}
            {recentFiddlesSection && <hr />}

            {previousVersionSection}
            {previousVersionSection && <hr />}

            {temporyWarningSection}
            {temporyWarningSection && <hr />}

        </div>
    )
}

const getInitialRecentFiddlesFromLocalStorage = (): {title: string, url: string}[] => {
    const recentFiddles = localStorage.getItem('recentFiddles')
    if (!recentFiddles) return []
    try {
        return JSON.parse(recentFiddles)
    } catch (e) {
        return []
    }
}

const useRecentFiddles = () => {
    const [recentFiddles, setRecentFiddles] = useState<{title: string, url: string}[]>(getInitialRecentFiddlesFromLocalStorage())
    const addRecentFiddle = useCallback((title: string, url: string) => {
        if (recentFiddles.length > 0 && recentFiddles[0].url === url) return // important so we don't change the object
        let newRecentFiddles = [{title, url}, ...recentFiddles.filter(rf => rf.url !== url)]
        if (newRecentFiddles.length > 50) {
            newRecentFiddles = newRecentFiddles.slice(0, 50)
        }
        setRecentFiddles(newRecentFiddles)
        localStorage.setItem('recentFiddles', JSON.stringify(newRecentFiddles))
    }, [recentFiddles])
    return { recentFiddles, addRecentFiddle }
}

const refsAreEqual = (a: any, b: any) => {
    if (!a) return a === b
    if (typeof a === 'string') {
        return a === b
    }
    if (typeof a === 'number') {
        return a === b
    }
    if (Array.isArray(a)) {
        if (!Array.isArray(b)) return false
        if (a.length !== b.length) return false
        for (let i = 0; i < a.length; i++) {
            if (!refsAreEqual(a[i], b[i])) return false
        }
        return true
    }
    if (typeof a === 'object') {
        if (typeof b !== 'object') return false
        const keys = Object.keys(a)
        if (keys.length !== Object.keys(b).length) return false
        for (const key of keys) {
            if (!refsAreEqual(a[key], b[key])) return false
        }
        return true
    }
    throw Error('Unexpected')
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Thanks: https://stackoverflow.com/questions/16167581/sort-object-properties-and-json-stringify
export const JSONStringifyDeterministic = (obj: any, space: string | number | undefined = undefined) => {
    const allKeys: string[] = [];
    JSON.stringify(obj, function (key, value) {
        allKeys.push(key);
        return value;
    });
    allKeys.sort();
    return JSON.stringify(obj, allKeys, space);
};


export default LeftPanel
