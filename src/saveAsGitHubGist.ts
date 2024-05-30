import {Octokit} from '@octokit/core';

const saveAsGitHubGist = async (files: {[key: string]: string}, defaultDescription: string) => {
    const token = prompt("SAVING AS PUBLIC GIST: Enter your GitHub personal access token (this will not be stored):");
    if (!token) {
        return;
    }
    const description = prompt("SAVING AS PUBLIC GIST: Enter a description:", defaultDescription);
    if (!description) {
        return;
    }
    const octokit = new Octokit({
        auth: token
    });
    const files2: {[key: string]: {content: string}} = {};
    for (const key in files) {
        files2[key] = {content: files[key]};
    }
    const r = await octokit.request('POST /gists', {
        description,
        'public': true,
        files: files2,
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });
    // const gistId = r.data.id;
    const gistUrl = r.data.html_url;
    return gistUrl;
}

export default saveAsGitHubGist;