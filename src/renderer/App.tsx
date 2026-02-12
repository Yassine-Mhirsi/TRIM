import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import TrimControls from "./components/TrimControls";

type ProbeResult = {
  durationSeconds: number;
  width: number;
  height: number;
  format: string;
};

type TrimRange = {
  start: number;
  end: number;
};

const TRIM_EPSILON_SECONDS = 0.01;

function toFileUrl(localPath: string): string {
  const normalized = localPath.replace(/\\/g, "/");
  const encoded = encodeURI(normalized);
  if (encoded.startsWith("/")) {
    return `file://${encoded}`;
  }
  return `file:///${encoded}`;
}

function makeJobId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMmSs(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeTrimRange(range: TrimRange, duration: number): TrimRange {
  const maxDuration = Math.max(0, duration);
  const minWindow = Math.min(TRIM_EPSILON_SECONDS, maxDuration);
  const maxStart = Math.max(0, maxDuration - minWindow);
  const start = clamp(range.start, 0, maxStart);
  const end = clamp(range.end, start + minWindow, maxDuration);
  return { start, end };
}

export default function App(): ReactElement {
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [trimRange, setTrimRange] = useState<TrimRange>({ start: 0, end: 0 });
  const [outputPath, setOutputPath] = useState<string>("");
  const [isTrimming, setIsTrimming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVideo = useCallback(async (nextPath: string) => {
    setError(null);
    setInputPath(nextPath);

    try {
      const metadata = await window.trimApi.probeVideo(nextPath);
      setProbe(metadata);
      setTrimRange(normalizeTrimRange({ start: 0, end: metadata.durationSeconds }, metadata.durationSeconds));
      const suggested = await window.trimApi.suggestOutputPath(nextPath);
      setOutputPath(suggested);
    } catch (loadError) {
      setProbe(null);
      setTrimRange({ start: 0, end: 0 });
      setOutputPath("");
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected file.");
    }
  }, []);

  useEffect(() => {
    window.trimApi.getInitialFile().then((filePath) => {
      if (filePath) {
        void loadVideo(filePath);
      }
    });

    const unsubscribe = window.trimApi.onFileOpened((filePath) => {
      void loadVideo(filePath);
    });

    return () => unsubscribe();
  }, [loadVideo]);

  const duration = probe?.durationSeconds ?? 0;
  const normalizedTrimRange = useMemo(
    () => normalizeTrimRange(trimRange, duration),
    [trimRange, duration]
  );
  const startSeconds = normalizedTrimRange.start;
  const endSeconds = normalizedTrimRange.end;
  const disableExport = !inputPath || !probe || isTrimming || endSeconds <= startSeconds;
  const exportDuration = useMemo(() => Math.max(0, endSeconds - startSeconds), [endSeconds, startSeconds]);

  const chooseSaveAs = async (): Promise<void> => {
    if (!outputPath) {
      return;
    }

    const selected = await window.trimApi.chooseSavePath(outputPath);
    if (selected) {
      setOutputPath(selected);
    }
  };

  const onTrim = async (): Promise<void> => {
    if (!inputPath || !outputPath) {
      return;
    }

    setIsTrimming(true);
    setError(null);

    try {
      const result = await window.trimApi.trimVideo(
        {
          jobId: makeJobId(),
          inputPath,
          outputPath,
          startSeconds,
          endSeconds,
          mode: "smart"
        },
        () => undefined
      );

      if (!result.ok) {
        throw new Error(result.error ?? "Trim failed.");
      }

      const nextSuggested = await window.trimApi.suggestOutputPath(inputPath);
      setOutputPath(nextSuggested);
    } catch (trimError) {
      setError(trimError instanceof Error ? trimError.message : "Trim failed.");
    } finally {
      setIsTrimming(false);
    }
  };

  return (
    <main className="app-shell">
      {inputPath && (
        <video className="video-preview" controls src={toFileUrl(inputPath)}>
          <track kind="captions" />
        </video>
      )}

      {probe && (
        <TrimControls
          duration={duration}
          start={startSeconds}
          end={endSeconds}
          disabled={isTrimming}
          onChangeStart={(value) =>
            setTrimRange((current) =>
              normalizeTrimRange(
                {
                  start: value,
                  end: current.end
                },
                duration
              )
            )
          }
          onChangeEnd={(value) =>
            setTrimRange((current) =>
              normalizeTrimRange(
                {
                  start: current.start,
                  end: value
                },
                duration
              )
            )
          }
        />
      )}

      {probe && (
        <div className="action-row">
          <div className="button-row">
            {isTrimming && <span className="spinner" aria-label="Trimming in progress" />}
            <button type="button" onClick={chooseSaveAs} disabled={isTrimming}>
              Save As
            </button>
            <button type="button" onClick={onTrim} disabled={disableExport}>
              {isTrimming ? "Trimming..." : `Export (${formatMmSs(exportDuration)})`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}
