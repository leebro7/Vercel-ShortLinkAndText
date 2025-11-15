const { app, BrowserWindow, Menu, ipcMain } = require("electron")
const path = require("path")
const isDev = require("electron-is-dev")
const Store = require("electron-store")

const storage = new Store()

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
    },
    icon: path.join(__dirname, "../public/favicon.ico"),
  })

  const startUrl = isDev ? "http://localhost:3000" : `file://${path.join(__dirname, "../out/index.html")}`

  mainWindow.loadURL(startUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

app.on("ready", createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// IPC handlers for local storage
ipcMain.handle("store:get", (event, key) => {
  return storage.get(key)
})

ipcMain.handle("store:set", (event, key, value) => {
  storage.set(key, value)
})

ipcMain.handle("store:delete", (event, key) => {
  storage.delete(key)
})

// Application menu
const template = [
  {
    label: "文件",
    submenu: [
      {
        label: "退出",
        accelerator: "CmdOrCtrl+Q",
        click: () => {
          app.quit()
        },
      },
    ],
  },
  {
    label: "编辑",
    submenu: [
      { label: "撤销", accelerator: "CmdOrCtrl+Z", role: "undo" },
      { label: "重做", accelerator: "CmdOrCtrl+Y", role: "redo" },
      { type: "separator" },
      { label: "剪切", accelerator: "CmdOrCtrl+X", role: "cut" },
      { label: "复制", accelerator: "CmdOrCtrl+C", role: "copy" },
      { label: "粘贴", accelerator: "CmdOrCtrl+V", role: "paste" },
    ],
  },
  {
    label: "视图",
    submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }],
  },
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)
