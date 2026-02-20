import type {
  TrimRequest,
  TrimResult,
  VideoProbeResult
} from "../../main/services/ffmpegService";

declare global {
  const __APP_VERSION__: string;

  interface Window {
    trimApi: {
      getInitialFile: () => Promise<string | null>;
      openVideo: () => Promise<string | null>;
      onFileOpened: (handler: (filePath: string) => void) => () => void;
      getRecentFiles: () => Promise<string[]>;
      addRecentFile: (filePath: string) => Promise<void>;
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
      onUpdateAvailable: (handler: (version: string) => void) => () => void;
      onDownloadProgress: (handler: (percent: number) => void) => () => void;
      onUpdateDownloaded: (handler: (version: string) => void) => () => void;
      saveFrameAsPng: (buffer: ArrayBuffer, inputPath: string, outputPath: string, currentTime: number) => Promise<string>;
      checkForUpdates: () => Promise<void>;
      downloadUpdate: () => Promise<void>;
      installUpdate: () => void;
    };
  }
}

export {};
