/* eslint-disable @typescript-eslint/no-explicit-any */
// import { Octokit } from "@octokit/rest";

// having trouble with Octokit type
type Octokit = any;

/* eslint-disable @typescript-eslint/no-explicit-any */
// adapted from https://github.com/mheap/octokit-commit-multiple-files/blob/main/create-or-update-files.js
// on 5/23/24

// we are not going to check for base64 in this way, because what if we wanted to write a file with text that looks like base64?
// function isBase64(str) {
//     // Handle buffer inputs
//     if (Buffer.isBuffer(str)) {
//       str = str.toString("utf8");
//     }

//     var notBase64 = /[^A-Z0-9+\/=]/i;
//     const isString = typeof str === "string" || str instanceof String;

//     if (!isString) {
//       let invalidType;
//       if (str === null) {
//         invalidType = "null";
//       } else {
//         invalidType = typeof str;
//         if (
//           invalidType === "object" &&
//           str.constructor &&
//           str.constructor.hasOwnProperty("name")
//         ) {
//           invalidType = str.constructor.name;
//         } else {
//           invalidType = `a ${invalidType}`;
//         }
//       }
//       throw new TypeError(`Expected string but received ${invalidType}.`);
//     }

//     const len = str.length;
//     if (!len || len % 4 !== 0 || notBase64.test(str)) {
//       return false;
//     }
//     const firstPaddingChar = str.indexOf("=");
//     return (
//       firstPaddingChar === -1 ||
//       firstPaddingChar === len - 1 ||
//       (firstPaddingChar === len - 2 && str[len - 1] === "=")
//     );
//   }


// jfm fixed some things related to async / try catch / return
export default async function gitHubCreateOrUpdateFiles(octokit: Octokit, opts: {
  owner: string;
  repo: string;
  branch: string;
  changes: {
    message: string;
    files?: {
      [path: string]: {
        contents: string;
        mode?: string;
        type?: string;
      };
    };
    filesToDelete?: string[];
    ignoreDeletionFailures?: boolean;
  }[];
  batchSize: number;
  base?: string;
  createBranch?: boolean;
  committer: {
    name: string;
    email: string;
  };
  author: {
    name: string;
    email: string;
  };
  forkFromBaseBranch?: boolean;
}) {
  // Up front validation
  if (!opts.changes || !opts.changes.length) {
    throw Error("No changes provided");
  }

  if (!opts.batchSize) {
    opts.batchSize = 1;
  }

  // Destructuring for easier access later
  const {
    owner,
    repo,
    branch: branchName,
    createBranch,
    committer,
    author,
    changes,
    batchSize,
    forkFromBaseBranch,
  } = opts;

  let { base } = opts

  let branchAlreadyExists = true;

  // Does the target branch already exist?
  let baseTree = await loadRef(octokit, owner, repo, branchName);
  if (!baseTree || forkFromBaseBranch) {
    if (!createBranch && !baseTree) {
      throw Error(
        `The branch '${branchName}' doesn't exist and createBranch is 'false'`,
      );
    }

    if (!baseTree) {
      branchAlreadyExists = false;
    }

    // If not we use the base branch. If not provided, use the
    // default from the repo
    if (!base) {
      // Work out the default branch
      base = (
        await octokit.rest.repos.get({
          owner,
          repo,
        })
      ).data.default_branch;
    }

    if (!base) {
      throw Error("No base branch provided and no default branch found");
    }
    baseTree = await loadRef(octokit, owner, repo, base);

    if (!baseTree) {
      throw Error(`The branch '${base}' doesn't exist`);
    }
  }

  // Create blobs
  const commits: any[] = [];
  for (const change of changes) {
    const message = change.message;
    if (!message) {
      throw Error(`changes[].message is a required parameter`);
    }

    const hasFiles = change.files && Object.keys(change.files).length > 0;

    const hasFilesToDelete =
      Array.isArray(change.filesToDelete) &&
      change.filesToDelete.length > 0;

    if (!hasFiles && !hasFilesToDelete) {
      throw Error(
        `either changes[].files or changes[].filesToDelete are required`,
      );
    }

    const treeItems: TreeItem[] = [];
    // Handle file deletions
    if ((hasFilesToDelete) && (change.filesToDelete)) {
      for (const batch of chunk(change.filesToDelete, batchSize)) {
        await Promise.all(
          batch.map(async (fileName) => {
            if (!baseTree) {
              throw Error('Unexpected error: baseTree is undefined')
            }
            const exists = await fileExistsInRepo(
              octokit,
              owner,
              repo,
              fileName,
              baseTree,
            );

            // If it doesn't exist, and we're not ignoring missing files
            // reject the promise
            if (!exists && !change.ignoreDeletionFailures) {
              throw Error(
                `The file ${fileName} could not be found in the repo`,
              );
            }

            // At this point it either exists, or we're ignoring failures
            if (exists) {
              treeItems.push({
                path: fileName,
                sha: null, // sha as null implies that the file should be deleted
                mode: "100644",
                type: "commit",
              });
            }
          }),
        );
      }
    }

    if (change.files) {
      for (const batch of chunk(Object.keys(change.files), batchSize)) {
        await Promise.all(
          batch.map(async (fileName) => {
            if (!change.files) {
              throw Error('Unexpected error: change.files is undefined');
            }
            // const properties = change.files[fileName] || "";
            // const contents = properties.contents || properties;

            const contents = change.files[fileName].contents;

            const mode = change.files[fileName].mode || "100644";
            const type = change.files[fileName].type || "blob";

            if (!contents) {
              throw Error(`No file contents provided for ${fileName}`);
            }

            const fileSha = await createBlob(
              octokit,
              owner,
              repo,
              contents,
              type,
            );

            treeItems.push({
              path: fileName,
              sha: fileSha,
              mode: mode,
              type: type,
            });
          }),
        );
      }
    }

    // no need to issue further requests if there are no updates, creations and deletions
    if (treeItems.length === 0) {
      continue;
    }

    // Add those blobs to a tree
    const tree = await createTree(
      octokit,
      owner,
      repo,
      treeItems,
      baseTree,
    );

    // Create a commit that points to that tree
    const commit = await createCommit(
      octokit,
      owner,
      repo,
      committer,
      author,
      message,
      tree,
      baseTree,
    );

    // Update the base tree if we have another commit to make
    baseTree = commit.sha;
    commits.push(commit);
  }

  // Create a ref that points to that tree
  let action = "createRef";
  let updateRefBase = "refs/";

  // Or if it already exists, we'll update that existing ref
  if (branchAlreadyExists) {
    action = "updateRef";
    updateRefBase = "";
  }

  await octokit.rest.git[action]({
    owner,
    repo,
    force: true,
    ref: `${updateRefBase}heads/${branchName}`,
    sha: baseTree,
  });

  return commits;
}

async function fileExistsInRepo(octokit: Octokit, owner: string, repo: string, path: string, branch: string) {
  try {
    await octokit.rest.repos.getContent({
      method: "HEAD",
      owner,
      repo,
      path,
      ref: branch,
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function createCommit(
  octokit: Octokit,
  owner: string,
  repo: string,
  committer: {
    name: string;
    email: string;
  },
  author: {
    name: string;
    email: string;
  },
  message: string,
  tree: TreeItem,
  baseTree: string,
) {
  if (!tree.sha) {
    throw Error("No tree sha provided");
  }
  return (
    await octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      committer,
      author,
      tree: tree.sha,
      parents: [baseTree],
    })
  ).data;
}

type TreeItem = {
  path?: string;
  sha?: string | null;
  mode?: string;
  type?: string;
  content?: string;
}

async function createTree(octokit: Octokit, owner: string, repo: string, treeItems: TreeItem[], baseTree: string | undefined) {
  return (
    await octokit.rest.git.createTree({
      owner,
      repo,
      tree: treeItems as any,
      base_tree: baseTree,
    })
  ).data;
}

async function createBlob(octokit: Octokit, owner: string, repo: string, contents: string, type: string) {
  if (type === "commit") {
    return contents;
  } else {
    let content = contents;

    // see comment above
    // if (!isBase64(content)) {
    //   content = Buffer.from(contents).toString("base64");
    // }
    content = Buffer.from(contents).toString("base64");

    const file = (
      await octokit.rest.git.createBlob({
        owner,
        repo,
        content,
        encoding: "base64",
      })
    ).data;
    return file.sha;
  }
}

async function loadRef(octokit: Octokit, owner: string, repo: string, ref: string) {
  try {
    const x = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${ref}`,
    });
    return x.data.object.sha;
  } catch (e) {
    // console.log(e);
  }
}

const chunk = (input: string[], size: number) => {
  return input.reduce((arr: string[][], item: string, idx: number) => {
    return idx % size === 0
      ? [...arr, [item]]
      : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
  }, []);
};