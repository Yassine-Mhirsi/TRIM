import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { autoUpdater } from "electron-updater";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  findAvailableOutputPath,
  isSupportedVideo,
  overwriteVideo,
  probeVideo,
  suggestOutputPath,
  trimVideo,
  validateInputVideo,
  type TrimRequest
} from "../src/main/services/ffmpegService";
import { addRecentFile, getRecentFiles } from "../src/main/services/recentFiles";
import { getWindowState, saveWindowState } from "../src/main/services/windowState";

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

function normalizeArgPath(value: string): string {
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }
  return value;
}

function extractFileArg(argv: string[]): string | null {
  // Walk backwards and pick the first existing, supported video path.
  for (let index = argv.length - 1; index >= 0; index -= 1) {
    const raw = argv[index] ?? "";
    if (raw.startsWith("-")) {
      continue;
    }

    const candidate = normalizeArgPath(raw);
    if (!candidate || candidate.toLowerCase().endsWith(".exe")) {
      continue;
    }

    if (existsSync(candidate) && isSupportedVideo(candidate)) {
      return candidate;
    }
  }

  return null;
}

function sendFileToRenderer(filePath: string): void {
  addRecentFile(filePath);
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingFilePath = filePath;
    return;
  }

  mainWindow.webContents.send("app:file-opened", filePath);
}

async function createWindow(): Promise<void> {
  // Remove the default menu bar entirely
  Menu.setApplicationMenu(null);

  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
  const savedBounds = getWindowState();

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1160,
    height: savedBounds?.height ?? 780,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 640,
    minHeight: 480,
    icon: path.join(app.getAppPath(), "assets", "app-icon.png"),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0f1222",
      symbolColor: "#8891b3",
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow loading file:// videos when the app is served from localhost (dev)
      webSecurity: !isDev
    }
  });

  // Persist window bounds on move/resize (debounced)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const debouncedSave = (): void => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) {
        saveWindowState(mainWindow.getBounds());
      }
    }, 500);
  };

  mainWindow.on("resize", debouncedSave);
  mainWindow.on("move", debouncedSave);
  mainWindow.on("close", () => {
    if (mainWindow && !mainWindow.isMinimized()) {
      saveWindowState(mainWindow.getBounds());
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    const rendererPath = path.join(app.getAppPath(), "dist", "index.html");
    await mainWindow.loadURL(pathToFileURL(rendererPath).toString());
  }

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const nextFile = extractFileArg(argv);
    if (nextFile) {
      sendFileToRenderer(nextFile);
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    pendingFilePath = extractFileArg(process.argv);
    await createWindow();
    setupAutoUpdater();
  });
}

function logToRenderer(message: string): void {
  mainWindow?.webContents.executeJavaScript(
    `console.log("[updater]", ${JSON.stringify(message)})`
  ).catch(() => {/* ignore if webContents not ready */});
}

function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    logToRenderer("Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    logToRenderer(`Update available: v${info.version}`);
    mainWindow?.webContents.send("updater:update-available", info.version);
  });

  autoUpdater.on("update-not-available", (info) => {
    logToRenderer(`No update available (current: ${app.getVersion()}, latest: ${info.version})`);
  });

  autoUpdater.on("download-progress", (progress) => {
    logToRenderer(`Download progress: ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total})`);
    mainWindow?.webContents.send("updater:download-progress", progress.percent);
  });

  autoUpdater.on("update-downloaded", (info) => {
    logToRenderer(`Update downloaded: v${info.version}`);
    mainWindow?.webContents.send("updater:update-downloaded", info.version);
  });

  autoUpdater.on("error", (err) => {
    logToRenderer(`Error: ${err.message}\n${err.stack ?? ""}`);
  });

  ipcMain.handle("updater:check", async () => {
    logToRenderer("Manual check triggered");
    await autoUpdater.checkForUpdates();
  });

  ipcMain.handle("updater:download", async () => {
    logToRenderer("Download triggered");
    await autoUpdater.downloadUpdate();
  });

  ipcMain.on("updater:install", () => {
    logToRenderer("Install triggered — quitting and installing");
    autoUpdater.quitAndInstall();
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      logToRenderer(`Auto-check failed: ${err.message}`);
    });
  }, 3000);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

ipcMain.handle("app:get-initial-file", async () => {
  const fileToReturn = pendingFilePath;
  pendingFilePath = null;
  if (fileToReturn) addRecentFile(fileToReturn);
  return fileToReturn;
});

ipcMain.handle("recent-files:get", () => {
  return getRecentFiles();
});

ipcMain.handle("recent-files:add", (_event, filePath: string) => {
  addRecentFile(filePath);
});

ipcMain.handle("trim:probe", async (_event, filePath: string) => {
  await validateInputVideo(filePath);
  return probeVideo(filePath);
});

ipcMain.handle("trim:suggest-output-path", async (_event, inputPath: string) => {
  const candidate = suggestOutputPath(inputPath);
  return findAvailableOutputPath(candidate);
});

ipcMain.handle("dialog:open-video", async () => {
  mainWindow?.focus();
  const opts = {
    title: "Open Video",
    filters: [{ name: "Video Files", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v"] }],
    properties: ["openFile" as const]
  };
  const { canceled, filePaths } = mainWindow
    ? await dialog.showOpenDialog(mainWindow, opts)
    : await dialog.showOpenDialog(opts);

  if (canceled || !filePaths?.length) {
    return null;
  }

  const filePath = filePaths[0];
  if (isSupportedVideo(filePath)) {
    addRecentFile(filePath);
    return filePath;
  }
  return null;
});

ipcMain.handle("dialog:save-as", async (_event, suggestedPath: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: suggestedPath,
    filters: [{ name: "Video Files", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v"] }]
  });

  if (canceled || !filePath) {
    return null;
  }

  return filePath;
});

ipcMain.handle("trim:start", async (event, request: TrimRequest) => {
  return trimVideo(request, (progress) => {
    event.sender.send(`trim:progress:${request.jobId}`, progress);
  });
});

ipcMain.handle("trim:overwrite", async (event, request: Omit<TrimRequest, "outputPath">) => {
  return overwriteVideo(request, (progress) => {
    event.sender.send(`trim:progress:${request.jobId}`, progress);
  });
});
