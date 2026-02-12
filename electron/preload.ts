import { contextBridge, ipcRenderer } from "electron";
import type {
  TrimRequest,
  TrimResult,
  VideoProbeResult
} from "../src/main/services/ffmpegService";

type AppApi = {
  getInitialFile: () => Promise<string | null>;
  onFileOpened: (handler: (filePath: string) => void) => () => void;
  probeVideo: (filePath: string) => Promise<VideoProbeResult>;
  suggestOutputPath: (inputPath: string) => Promise<string>;
  chooseSavePath: (suggestedPath: string) => Promise<string | null>;
  trimVideo: (
    request: TrimRequest,
    onProgress: (value: number) => void
  ) => Promise<TrimResult>;
};

const api: AppApi = {
  getInitialFile: () => ipcRenderer.invoke("app:get-initial-file"),
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
  chooseSavePath: (suggestedPath) =>
    ipcRenderer.invoke("dialog:save-as", suggestedPath),
  trimVideo: (request, onProgress) =>
    new Promise((resolve, reject) => {
      const channel = `trim:progress:${request.jobId}`;
      const onProgressMessage = (
        _event: Electron.IpcRendererEvent,
        progress: number
      ) => onProgress(progress);

      ipcRenderer.on(channel, onProgressMessage);

      ipcRenderer
        .invoke("trim:start", request)
        .then((result: TrimResult) => resolve(result))
        .catch((error: unknown) => reject(error))
        .finally(() => {
          ipcRenderer.removeListener(channel, onProgressMessage);
        });
    })
};

contextBridge.exposeInMainWorld("trimApi", api);
