import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
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
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingFilePath = filePath;
    return;
  }

  mainWindow.webContents.send("app:file-opened", filePath);
}

async function createWindow(): Promise<void> {
  // Remove the default menu bar entirely
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 980,
    minHeight: 700,
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
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    const rendererPath = path.join(app.getAppPath(), "dist", "index.html");
    await mainWindow.loadURL(pathToFileURL(rendererPath).toString());
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
  });
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
  return fileToReturn;
});

ipcMain.handle("trim:probe", async (_event, filePath: string) => {
  await validateInputVideo(filePath);
  return probeVideo(filePath);
});

ipcMain.handle("trim:suggest-output-path", async (_event, inputPath: string) => {
  const candidate = suggestOutputPath(inputPath);
  return findAvailableOutputPath(candidate);
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
