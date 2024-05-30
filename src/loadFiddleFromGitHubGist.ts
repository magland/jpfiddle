import { Octokit } from "@octokit/rest"
import { Fiddle } from "./types"

const loadFiddleFromGitHubGist = async (gistUri: string): Promise<Fiddle> => {
    const parts = gistUri.split('/')
    const gistId = parts[parts.length - 1]
    const octokit = new Octokit()
    const r = await octokit.request('GET /gists/{gist_id}', {
        gist_id: gistId,
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    })
    const gist = r.data
    const description = gist.description
    const files = gist.files
    const refs: { [key: string]: string } = {}
    for (const fname in files) {
        const file = files[fname]
        if (!file) continue
        const content = file.content
        if (content === undefined) continue
        const fname2 = replaceBarsWithSlashes(fname)
        refs[fname2] = content
    }
    const fiddle: Fiddle = {
        jpfiddle: {
            title: description || 'no-gist-description'
        },
        refs
    }
    return fiddle
}

const replaceBarsWithSlashes = (s: string) => {
    return s.split('|').join('/')
}

export default loadFiddleFromGitHubGist