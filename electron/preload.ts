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
  overwriteVideo: (
    request: Omit<TrimRequest, "outputPath">,
    onProgress: (value: number) => void
  ) => Promise<TrimResult>;
};

function invokeWithProgress(
  channel: string,
  request: TrimRequest | Omit<TrimRequest, "outputPath">,
  onProgress: (value: number) => void
): Promise<TrimResult> {
  return new Promise((resolve, reject) => {
    const progressChannel = `trim:progress:${request.jobId}`;
    const onProgressMessage = (
      _event: Electron.IpcRendererEvent,
      progress: number
    ) => onProgress(progress);

    ipcRenderer.on(progressChannel, onProgressMessage);

    ipcRenderer
      .invoke(channel, request)
      .then((result: TrimResult) => resolve(result))
      .catch((error: unknown) => reject(error))
      .finally(() => {
        ipcRenderer.removeListener(progressChannel, onProgressMessage);
      });
  });
}

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
    invokeWithProgress("trim:start", request, onProgress),
  overwriteVideo: (request, onProgress) =>
    invokeWithProgress("trim:overwrite", request, onProgress)
};

contextBridge.exposeInMainWorld("trimApi", api);
