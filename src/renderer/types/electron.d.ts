import type {
  TrimRequest,
  TrimResult,
  VideoProbeResult
} from "../../main/services/ffmpegService";

declare global {
  interface Window {
    trimApi: {
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
  }
}

export {};
