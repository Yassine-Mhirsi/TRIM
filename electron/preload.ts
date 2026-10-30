import { contextBridge, ipcRenderer } from "electron";
import type {
  AudioExtractionRequest,
  AudioExtractionResult,
  TrimRequest,
  TrimResult,
  VideoProbeResult
} from "../src/main/services/ffmpegService";

type AppApi = {
  getInitialFile: () => Promise<string | null>;
  openVideo: () => Promise<string | null>;
  onFileOpened: (handler: (filePath: string) => void) => () => void;
  getRecentFiles: () => Promise<string[]>;
  addRecentFile: (filePath: string) => Promise<void>;
  probeVideo: (filePath: string) => Promise<VideoProbeResult>;
  suggestOutputPath: (inputPath: string) => Promise<string>;
  suggestAudioOutputPath: (inputPath: string) => Promise<string>;
  chooseSavePath: (suggestedPath: string) => Promise<string | null>;
  trimVideo: (
    request: TrimRequest,
    onProgress: (value: number) => void
  ) => Promise<TrimResult>;
  overwriteVideo: (
    request: Omit<TrimRequest, "outputPath">,
    onProgress: (value: number) => void
  ) => Promise<TrimResult>;
  extractAudio: (
    request: AudioExtractionRequest,
    onProgress: (value: number) => void
  ) => Promise<AudioExtractionResult>;
  onUpdateAvailable: (handler: (version: string) => void) => () => void;
  onDownloadProgress: (handler: (percent: number) => void) => () => void;
  onUpdateDownloaded: (handler: (version: string) => void) => () => void;
  saveFrameAsPng: (buffer: ArrayBuffer, inputPath: string, outputPath: string, currentTime: number) => Promise<string>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;
};

function invokeWithProgress<TReq extends { jobId: string }, TRes>(
  channel: string,
  progressChannelPrefix: string,
  request: TReq,
  onProgress: (value: number) => void
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const progressChannel = `${progressChannelPrefix}:${request.jobId}`;
    const onProgressMessage = (
      _event: Electron.IpcRendererEvent,
      progress: number
    ) => onProgress(progress);

    ipcRenderer.on(progressChannel, onProgressMessage);

    ipcRenderer
      .invoke(channel, request)
      .then((result: TRes) => resolve(result))
      .catch((error: unknown) => reject(error))
      .finally(() => {
        ipcRenderer.removeListener(progressChannel, onProgressMessage);
      });
  });
}

const api: AppApi = {
  getInitialFile: () => ipcRenderer.invoke("app:get-initial-file"),
  openVideo: () => ipcRenderer.invoke("dialog:open-video"),
  getRecentFiles: () => ipcRenderer.invoke("recent-files:get"),
  addRecentFile: (filePath: string) => ipcRenderer.invoke("recent-files:add", filePath),
  onFileOpened: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => {
      handler(filePath);
    };
    ipcRenderer.on("app:file-opened", listener);
    return () => ipcRenderer.removeListener("app:file-opened", listener);
  },
  probeVideo: (filePath) => ipcRenderer.invoke("trim:probe", filePath),
  suggestOutputPath: (inputPath) =>
    ipcRenderer.invoke("trim:suggest-output-path", inputPath),
  suggestAudioOutputPath: (inputPath) =>
    ipcRenderer.invoke("audio:suggest-output-path", inputPath),
  chooseSavePath: (suggestedPath) =>
    ipcRenderer.invoke("dialog:save-as", suggestedPath),
  trimVideo: (request, onProgress) =>
    invokeWithProgress<TrimRequest, TrimResult>("trim:start", "trim:progress", request, onProgress),
  overwriteVideo: (request, onProgress) =>
    invokeWithProgress<Omit<TrimRequest, "outputPath">, TrimResult>("trim:overwrite", "trim:progress", request, onProgress),
  extractAudio: (request, onProgress) =>
    invokeWithProgress<AudioExtractionRequest, AudioExtractionResult>("audio:extract", "audio:progress", request, onProgress),
  onUpdateAvailable: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, version: string) => handler(version);
    ipcRenderer.on("updater:update-available", listener);
    return () => ipcRenderer.removeListener("updater:update-available", listener);
  },
  onDownloadProgress: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, percent: number) => handler(percent);
    ipcRenderer.on("updater:download-progress", listener);
    return () => ipcRenderer.removeListener("updater:download-progress", listener);
  },
  onUpdateDownloaded: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, version: string) => handler(version);
    ipcRenderer.on("updater:update-downloaded", listener);
    return () => ipcRenderer.removeListener("updater:update-downloaded", listener);
  },
  saveFrameAsPng: (buffer, inputPath, outputPath, currentTime) =>
    ipcRenderer.invoke("frame:save-png", buffer, inputPath, outputPath, currentTime),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  downloadUpdate: () => ipcRenderer.invoke("updater:download"),
  installUpdate: () => ipcRenderer.send("updater:install")
};

contextBridge.exposeInMainWorld("trimApi", api);
