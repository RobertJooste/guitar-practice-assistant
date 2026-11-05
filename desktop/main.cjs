const { app, BrowserWindow, net, protocol } = require('electron')
const { resolve, sep } = require('node:path')
const { pathToFileURL } = require('node:url')

const APP_SCHEME = 'gpc'
const APP_HOST = 'app'
const DIST_DIRECTORY = resolve(__dirname, '../dist')

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      codeCache: true,
      allowServiceWorkers: false,
    },
  },
])

function isWithinRendererDirectory(filePath) {
  return (
    filePath === DIST_DIRECTORY ||
    filePath.startsWith(`${DIST_DIRECTORY}${sep}`)
  )
}

async function handleAppRequest(request) {
  let url
  let filePath

  try {
    url = new URL(request.url)
    if (url.host !== APP_HOST || !['GET', 'HEAD'].includes(request.method)) {
      return new Response('Not found', { status: 404 })
    }

    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
    filePath = resolve(DIST_DIRECTORY, relativePath)
  } catch (error) {
    console.error('Invalid local app request', error)
    return new Response('Bad request', { status: 400 })
  }

  if (!isWithinRendererDirectory(filePath)) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    return await net.fetch(pathToFileURL(filePath).href)
  } catch (error) {
    console.error(`Unable to load local app resource: ${filePath}`, error)
    return new Response('App resource not found', { status: 404 })
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    const destination = new URL(navigationUrl)
    if (destination.protocol !== `${APP_SCHEME}:` || destination.host !== APP_HOST) {
      event.preventDefault()
    }
  })
  window.webContents.on('did-finish-load', () => {
    console.info('Guitar Practice Companion desktop UI loaded')
  })

  window.loadURL(`${APP_SCHEME}://${APP_HOST}/`).catch((error) => {
    console.error('Unable to load the local desktop app', error)
    window.destroy()
  })
}

app.whenReady()
  .then(async () => {
    await protocol.handle(APP_SCHEME, handleAppRequest)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error) => {
    console.error('Unable to start Guitar Practice Companion', error)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
