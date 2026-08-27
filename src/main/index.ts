import "dotenv/config";
import { app, BrowserWindow, Menu, shell } from "electron";
import { join } from "path";
import { registerIpcHandlers } from "./ipc";
import { safeExternalUrl } from "./external-url";

let mainWindow: BrowserWindow | null = null;

// Packaged: out/ ends up nested inside app.asar, one level deeper than in
// dev, where out/ and resources/ are plain siblings at the project root.
// process.resourcesPath always points at the real resources/ folder either
// way (extraResources places icon.png there directly when packaged).
const iconPath = app.isPackaged
  ? join(process.resourcesPath, "icon.png")
  : join(__dirname, "../../resources/icon.png");

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    show: false,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());

  const sendMaximizedState = (): void =>
    mainWindow?.webContents.send("window-maximized-changed", mainWindow.isMaximized());
  mainWindow.on("maximize", sendMaximizedState);
  mainWindow.on("unmaximize", sendMaximizedState);

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = safeExternalUrl(details.url);
    if (url) {
      void shell.openExternal(url).catch((error) => {
        console.warn(`[external-url] could not open ${url}: ${error instanceof Error ? error.message : error}`);
      });
    }
    return { action: "deny" };
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers(() => mainWindow);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
