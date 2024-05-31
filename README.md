# jpfiddle

:warning: **This project is under construction.** :warning:

jpfiddle is a web application that allows users to share and collaborate on Python Jupyter notebooks with minimal friction. Importantly, it does not require a running Jupyter server to view and interact with the notebooks in a limited environment. Inspired by jsfiddle, it allows uploading directories of code to the cloud to be easily shared via URL. Supported file types include text formats such as .ipynb, .py, .md, etc.

Users can choose between a lightweight, browser-only version (JupyterLite) or a full-featured locally-hosted version (JupyterLab) to suit their needs. **For the Pyodide/Python kernel is disabled for the JupyterLite mode because we are encountering problems** There are pros and cons of each of these two options. JupyterLite is a lightweight version of JupyterLab that runs entirely in the browser using Pyodide (although as mentioned Pyodide is disabled for now). It is not as featureful as JupyterLab, but it is convenient for browsing a fiddle without needing to host a local server. But if you would like to execute cells, you can also use the "Local JupyterLab" option that requires you to [run a local JupyterLab server](./doc/local_jupyterlab.md).

This software should only be used for collaborative scientific research and educational purposes.

Files stored on the cloud are temporary and subject to deletion. For more permanent storage, there is an option for storing fiddles to GitHub Gists.

[Visit the live site](https://jpfiddle.vercel.app) - under construction.

To save files to the cloud, you will need a passcode which you can obtain from the author. If you do obtain the code, you can redistribute it to your trusted colleagues provided that they are also aware of this request. Please point them to this README. The passcode may change from time to time.

This software is build with [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and [Vite](https://vitejs.dev/) and uses [JupyterLite](https://github.com/jupyterlite/jupyterlite), [Pyodide](https://pyodide.org/en/stable/), and [JupyterLab](https://jupyter.org/). Related dependencies are [jpfiddle-jupyterlite](https://github.com/magland/jpfiddle-jupyterlite) and [jpfiddle_extension](https://github.com/magland/jpfiddle_extension).

## Example fiddles

* [plotly_example](https://jpfiddle.vercel.app/?f=https://gist.github.com/magland/420b6e8274281e360a7f2f87e265ae2e&t=plotly_example%20v3)
* [autocorrelograms for DANDI NWB](https://jpfiddle.vercel.app/?f=https://gist.github.com/magland/083cd125749a285c17675bf70403580a&t=jpfiddle%20example%3A%20autocorrelograms%20for%20dandi%20nwb)

## Contributing

We welcome code contributions and suggestions to this project. Please submit issues and pull requests via GitHub.

## License

This software is licensed under the Apache 2.0 license. See the [LICENSE](./LICENSE) file for details.

## Authors

Jeremy Magland, Center for Computational Mathematics, Flatiron Institute
