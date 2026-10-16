/**
 * Nyaksai — invisible desktop shell (Electron).
 *
 * Mirrors the stealth flags of the reference Tauri implementation:
 *   contentProtected: true  → win.setContentProtection(true)
 *       Windows: SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) — Win10 2004+
 *       macOS:   NSWindowSharingType = NSWindowSharingNone
 *       Result: the window never appears in screen shares, recordings or screenshots.
 *   skipTaskbar: true       → skipTaskbar: true (absent from taskbar / Dock)
 *   decorations: false      → frame: false, transparent: true
 *   visibleOnAllWorkspaces  → setVisibleOnAllWorkspaces(true)
 *
 * Two run modes:
 *   1. PACKAGED / SELF-CONTAINED (after `npm run dist`) — a full Next.js production
 *      server is bundled in resources/next-server. It is launched as a child process
 *      on a free local port with its SQLite database in the user data folder, and the
 *      invisible window loads it. No Node.js, no dev server, nothing else needed.
 *   2. DEV — falls back to NYAKSAI_URL (default http://localhost:3000), i.e. `npm run dev`
 *      in the project root, exactly like the original shell.
 */
const { app, BrowserWindow, Menu, globalShortcut, session, shell, dialog } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const path = require('path')

const DEV_EXTERNAL_URL = process.env.NYAKSAI_URL || 'http://localhost:3000'

/** @type {BrowserWindow | null} */
let win = null
/** @type {import('child_process').ChildProcess | null} */
let serverProc = null
let serverPort = 0

// ── Embedded server helpers ───────────────────────────────────────────────────

function bundledServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'next-server', 'server.js')
  }
  // dev: `npm run prepare-server` fills desktop/resources/next-server
  const dev = path.join(__dirname, 'resources', 'next-server', 'server.js')
  return fs.existsSync(dev) ? dev : null
}

/** Find a free localhost port by binding and releasing it. */
function freePort(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const srv = net.createServer()
      srv.once('error', () => tryPort(p + 1))
      srv.once('listening', () => srv.close(() => resolve(p)))
      srv.listen(p, '127.0.0.1')
    }
    tryPort(start)
  })
}

/** Copy the empty template SQLite db to a writable per-user location (once). */
function ensureDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'nyaksai.db')
  if (!fs.existsSync(dbPath)) {
    const template = app.isPackaged
      ? path.join(process.resourcesPath, 'nyaksai-template.db')
      : path.join(__dirname, 'resources', 'nyaksai-template.db')
    if (fs.existsSync(template)) {
      fs.copyFileSync(template, dbPath)
    } else {
      fs.closeSync(fs.openSync(dbPath, 'w')) // empty file — Prisma reports missing tables rather than crashing
    }
  }
  return dbPath
}

async function startBundledServer(serverJs) {
  serverPort = await freePort(39271)
  const dbPath = ensureDatabase()

  serverProc = spawn(process.execPath, [serverJs], {
    cwd: path.dirname(serverJs),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1', // run Electron's own Node binary as plain Node
      NODE_ENV: 'production',
      PORT: String(serverPort),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: 'file:' + dbPath.replace(/\\/g, '/'),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  serverProc.stderr.on('data', (d) => console.error('[nyaksai-server]', String(d).trim()))
  serverProc.on('exit', (code) => {
    serverProc = null
    if (code && code !== 0) console.error('[nyaksai-server] exited with code', code)
  })

  // Wait until the server answers before showing any window.
  const url = `http://127.0.0.1:${serverPort}/`
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (!serverProc) break // crashed during startup
    try {
      const res = await fetch(url)
      if (res.ok) return url
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('the embedded Nyaksai server did not become ready in time')
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(url) {
  win = new BrowserWindow({
    width: 460,
    height: 620,
    minWidth: 300,
    minHeight: 200,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    fullscreenable: false,
    skipTaskbar: true, // never in the taskbar (Win/Linux) or Dock (macOS)
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  // ---- THE INVISIBILITY SWITCH -------------------------------------------
  win.setContentProtection(true) // excluded from screen capture & recording
  win.setAlwaysOnTop(true, 'screen-saver') // above fullscreen apps
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (process.platform === 'darwin') {
    app.dock?.hide() // remove from macOS Dock entirely
  }
  // -------------------------------------------------------------------------

  win.once('ready-to-show', () => {
    win?.showInactive() // never steal focus from the meeting/interview app
  })

  win.loadURL(url)

  win.webContents.setWindowOpenHandler(({ url: external }) => {
    if (/^https?:/i.test(external)) shell.openExternal(external)
    return { action: 'deny' }
  })

  win.on('closed', () => {
    win = null
  })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => win?.showInactive())

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)

    // Let mic + screen capture work inside the shell without blocking prompts.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      const allowed = [
        'media',
        'audioCapture',
        'videoCapture',
        'display-capture',
        'fullscreen',
        'clipboard-sanitized-write',
      ]
      cb(allowed.includes(permission))
    })

    // Pick the run mode: embedded server (packaged / prepared) or external URL (dev).
    let targetUrl = DEV_EXTERNAL_URL
    const serverJs = bundledServerPath()
    if (serverJs && !process.env.NYAKSAI_URL) {
      try {
        targetUrl = await startBundledServer(serverJs)
        console.log('[nyaksai] embedded server ready on port', serverPort)
      } catch (e) {
        dialog.showErrorBox(
          'Nyaksai',
          'The embedded server failed to start.\n\n' +
            (e instanceof Error ? e.message : String(e))
        )
        app.quit()
        return
      }
    }

    createWindow(targetUrl)

    // Global hotkeys — work even when another app has focus.
    globalShortcut.register('CommandOrControl+B', () => {
      if (!win) return
      if (win.isVisible()) win.hide()
      else win.showInactive()
    })
    globalShortcut.register('CommandOrControl+Shift+X', () => {
      win?.webContents.send('nyaksai:capture')
    })
  })

  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => {
    if (serverProc) {
      try {
        serverProc.kill()
      } catch {
        /* already gone */
      }
      serverProc = null
    }
  })
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
