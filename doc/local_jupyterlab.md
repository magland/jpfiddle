# Connecting to a local JupyterLab

You can view and edit jpfiddles in a local JupyterLab environment. This is useful if you want the full power of a Python kernel on your local machine rather than using Pyodide in the browser.

## Setup

**Install JupyterLab if you haven't already. You can do this with pip**

```bash
pip install jupyterlab
```

**Install the jpfiddle JupyterLab extension**

```bash
pip install jpfiddle-extension
```

**Edit the JupyterLab configuration to allow access from the jpfiddle website.**

If you haven't already created a JupyterLab configuration file, create one

```bash
jupyter lab --generate-config
```

Add the following lines to the configuration file:

```python
c = get_config()
c.ServerApp.tornado_settings = {
    "headers": {
        "Content-Security-Policy": "frame-ancestors 'self' https://jpfiddle.vercel.app"
    }
}
# Change this token to something random and secure
c.ServerApp.token = 'your_token_here'

# Firefox is recommended!

# If you insist on using Chrome rather than Firefox
# then you will need to set the token to an empty string
# and disable the XSRF check, which poses a security risk.
# c.ServerApp.token = ''
# c.ServerApp.disable_check_xsrf = True
```

IMPORTANT: See the security and browser considerations below.

**Create a directory for your jpfiddles and start JupyterLab**

```bash
mkdir jpfiddles

cd jpfiddles
jupyter lab --no-browser
```

**Configure the jpfiddle website**

Copy the URL that JupyterLab prints to the console and paste it into the appropriate field on the jpfiddle website. For example:

```
http://localhost:8888/?token=your_token_here
```


## Security and browser considerations

It is recommended that you use Firefox rather than Chrome because Chrome has some features that make it difficult for JupyterLab to authenticate when it is embedded in the jpfiddle website.

**If you use Firefox (recommended)** then you can either use no token or you can set a token in the JupyterLab configuration file as above and include it in the URL that you paste into the jpfiddle website. For example:

```
http://localhost:8888/?token=your_token_here
```

**If you insist on using Chrome (not recommended)** then you will need to set `c.ServerApp.token = ''` and `c.ServerApp.disable_check_xsrf = True` in the JupyterLab configuration file. This is not recommended because it disables security features.