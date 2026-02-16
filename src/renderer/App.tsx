import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import VideoPlayer from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import { useVideoPlayer } from "./hooks/useVideoPlayer";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { normalizeTrimRange, type TrimRange } from "./utils/math";
import { formatTimestamp } from "./utils/time";

type ProbeResult = {
  durationSeconds: number;
  width: number;
  height: number;
  format: string;
};

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

export default function App(): ReactElement {
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [trimRange, setTrimRange] = useState<TrimRange>({ start: 0, end: 0 });
  const [outputPath, setOutputPath] = useState<string>("");
  const [isTrimming, setIsTrimming] = useState(false);
  const [isDetachingVideoForOverwrite, setIsDetachingVideoForOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

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
    const cleanupAvailable = window.trimApi.onUpdateAvailable((version) => {
      setPendingUpdate(version);
    });
    const cleanupProgress = window.trimApi.onDownloadProgress((percent) => {
      setDownloadProgress(Math.round(percent));
    });
    const cleanupDownloaded = window.trimApi.onUpdateDownloaded((version) => {
      setDownloadProgress(null);
      setPendingUpdate(null);
      setUpdateReady(version);
    });
    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
    };
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

  // Video player hook — pass inputPath so effects re-run when the video element mounts
  const videoSrc = inputPath && !isDetachingVideoForOverwrite ? toFileUrl(inputPath) : null;
  const { currentTime, isPlaying, playbackSpeed, volume, isMuted, togglePlay, seek, setPlaybackSpeed, setVolume, toggleMute } = useVideoPlayer({
    videoRef,
    trimStart: startSeconds,
    trimEnd: endSeconds,
    duration,
    src: videoSrc,
  });

  // Trim range change handlers
  const handleTrimStartChange = useCallback(
    (value: number) => {
      setTrimRange((current) =>
        normalizeTrimRange({ start: value, end: current.end }, duration)
      );
    },
    [duration]
  );

  const handleTrimEndChange = useCallback(
    (value: number) => {
      setTrimRange((current) =>
        normalizeTrimRange({ start: current.start, end: value }, duration)
      );
    },
    [duration]
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    togglePlay,
    seek,
    currentTime,
    trimStart: startSeconds,
    trimEnd: endSeconds,
    duration,
    onTrimStartChange: handleTrimStartChange,
    onTrimEndChange: handleTrimEndChange,
    disabled: !probe || isTrimming,
  });

  const disableSaveActions = !inputPath || !probe || isTrimming || endSeconds <= startSeconds;
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

  const onSaveCopy = async (): Promise<void> => {
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

  const onOverwriteOriginal = async (): Promise<void> => {
    if (!inputPath) {
      return;
    }
    const originalPath = inputPath;

    const confirmed = window.confirm(
      "This will replace the original file with the selected trimmed section. Continue?"
    );
    if (!confirmed) {
      return;
    }

    setIsTrimming(true);
    setError(null);
    setIsDetachingVideoForOverwrite(true);

    try {
      // Give the <video> element a tick to unmount and release file handles on Windows.
      await new Promise((resolve) => setTimeout(resolve, 75));
      const result = await window.trimApi.overwriteVideo(
        {
          jobId: makeJobId(),
          inputPath: originalPath,
          startSeconds,
          endSeconds,
          mode: "smart"
        },
        () => undefined
      );

      if (!result.ok) {
        throw new Error(result.error ?? "Overwrite failed.");
      }

      await loadVideo(originalPath);
    } catch (trimError) {
      setError(trimError instanceof Error ? trimError.message : "Overwrite failed.");
    } finally {
      setIsDetachingVideoForOverwrite(false);
      setIsTrimming(false);
    }
  };

  const handleOpenVideo = useCallback(async () => {
    setError(null);
    try {
      const filePath = await window.trimApi.openVideo();
      if (filePath) {
        void loadVideo(filePath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open video");
    }
  }, [loadVideo]);

  return (
    <main className="app-shell">
      {/* Titlebar drag region */}
      <div className="titlebar-drag-region">
        <span className="titlebar-version">TRIM (v{__APP_VERSION__})</span>
      </div>

      {!probe && (
        <div className="empty-state">
          <p className="empty-state-message">Open a video to trim</p>
          <button type="button" className="action-button-primary" onClick={handleOpenVideo}>
            Open Video
          </button>
        </div>
      )}

      {inputPath && videoSrc && (
        <VideoPlayer
          src={videoSrc}
          videoRef={videoRef}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          volume={volume}
          isMuted={isMuted}
          onTogglePlay={togglePlay}
          onSpeedChange={setPlaybackSpeed}
          onVolumeChange={setVolume}
          onToggleMute={toggleMute}
        />
      )}

      {probe && (
        <Timeline
          duration={duration}
          currentTime={currentTime}
          trimStart={startSeconds}
          trimEnd={endSeconds}
          disabled={isTrimming}
          onSeek={seek}
          onTrimStartChange={handleTrimStartChange}
          onTrimEndChange={handleTrimEndChange}
        />
      )}

      {probe && (
        <div className="controls-actions-row">
          <div className="action-buttons">
            {isTrimming && <span className="spinner" aria-label="Trimming in progress" />}
            <button
              type="button"
              className="icon-button"
              onClick={chooseSaveAs}
              disabled={isTrimming}
              aria-label="Choose destination file"
              title={`Choose destination file${outputPath ? ` (${outputPath})` : ""}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4.2c.6 0 1.18.24 1.6.66l1.18 1.18c.3.3.7.46 1.12.46H18.5A2.5 2.5 0 0 1 21 8.8v8.7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2.5-.5a.5.5 0 0 0-.5.5v11c0 .28.22.5.5.5h13a.5.5 0 0 0 .5-.5V8.8a.5.5 0 0 0-.5-.5h-4.88a3.58 3.58 0 0 1-2.53-1.05L9.9 6.08A.25.25 0 0 0 9.7 6H5.5Z" />
              </svg>
            </button>
            <button
              type="button"
              className="action-button-danger"
              onClick={onOverwriteOriginal}
              disabled={disableSaveActions}
            >
              {isTrimming ? "Trimming..." : "Overwrite Original"}
            </button>
            <button
              type="button"
              className="action-button-primary"
              onClick={onSaveCopy}
              disabled={disableSaveActions}
            >
              {isTrimming ? "Trimming..." : `Save Copy (${formatTimestamp(exportDuration)})`}
            </button>
          </div>
        </div>
      )}

      {pendingUpdate && downloadProgress === null && !updateReady && (
        <div className="update-banner">
          <div className="update-banner-icon">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L12 16M12 16L7 11M12 16L17 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="update-banner-text">
            <span className="update-banner-title">Update v{pendingUpdate} available</span>
            <span className="update-banner-subtitle">A new version is ready to download</span>
          </div>
          <button
            type="button"
            className="update-banner-button"
            onClick={() => { setDownloadProgress(0); void window.trimApi.downloadUpdate(); }}
          >
            Download
          </button>
        </div>
      )}

      {downloadProgress !== null && !updateReady && (
        <div className="update-banner">
          <div className="update-banner-text" style={{ flex: 1 }}>
            <div className="update-banner-progress-header">
              <span className="update-banner-title">Downloading update...</span>
              <span className="update-banner-percent">{downloadProgress}%</span>
            </div>
            <div className="update-banner-progress-track">
              <div
                className="update-banner-progress-fill"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {updateReady && (
        <div className="update-banner update-banner-ready">
          <div className="update-banner-icon">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="update-banner-text">
            <span className="update-banner-title">v{updateReady} ready to install</span>
            <span className="update-banner-subtitle">Restart to apply the update</span>
          </div>
          <button
            type="button"
            className="update-banner-button"
            onClick={() => window.trimApi.installUpdate()}
          >
            Restart
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}
