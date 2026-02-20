import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import VideoPlayer from "./components/VideoPlayer";
import Timeline from "./components/Timeline";
import ShortcutsOverlay from "./components/ShortcutsOverlay";
import { useVideoPlayer } from "./hooks/useVideoPlayer";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { normalizeTrimRange, type TrimRange } from "./utils/math";
import { formatTimestamp } from "./utils/time";

const SUPPORTED_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"]);

function fileName(fullPath: string): string {
  return fullPath.replace(/^.*[\\/]/, "");
}

function parentDir(fullPath: string): string {
  const parts = fullPath.replace(/\\/g, "/").split("/");
  parts.pop();
  return parts.pop() ?? "";
}

type ProbeResult = {
  durationSeconds: number;
  width: number;
  height: number;
  format: string;
  frameRate: number;
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
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isCapturingFrame, setIsCapturingFrame] = useState(false);
  const [frameCaptureSuccess, setFrameCaptureSuccess] = useState(false);

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
      await window.trimApi.addRecentFile(nextPath);
      window.trimApi.getRecentFiles().then(setRecentFiles);
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
      setDismissedUpdate(false);
    });
    const cleanupProgress = window.trimApi.onDownloadProgress((percent) => {
      setDownloadProgress(Math.round(percent));
    });
    const cleanupDownloaded = window.trimApi.onUpdateDownloaded((version) => {
      setDownloadProgress(null);
      setPendingUpdate(null);
      setUpdateReady(version);
      setDismissedUpdate(false);
    });
    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
    };
  }, []);

  useEffect(() => {
    window.trimApi.getRecentFiles().then(setRecentFiles);

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

  const frameDuration = probe ? 1 / probe.frameRate : 1 / 30;

  const handleToggleInfo = useCallback(() => {
    setShowInfo((prev) => !prev);
  }, []);

  const handleToggleShortcuts = useCallback(() => {
    setShowShortcuts((prev) => !prev);
  }, []);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !inputPath) return;

    setIsCapturingFrame(true);
    setFrameCaptureSuccess(false);
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context.");

      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to capture frame.");

      const arrayBuffer = await blob.arrayBuffer();
      // Use outputPath dir if available, otherwise fall back to inputPath dir
      const effectiveOutputPath = outputPath || inputPath;
      await window.trimApi.saveFrameAsPng(arrayBuffer, inputPath, effectiveOutputPath, video.currentTime);

      setFrameCaptureSuccess(true);
      setTimeout(() => setFrameCaptureSuccess(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save frame.");
    } finally {
      setIsCapturingFrame(false);
    }
  }, [videoRef, inputPath, outputPath]);

  const closeVideo = useCallback(() => {
    setProbe(null);
    setInputPath(null);
    setTrimRange({ start: 0, end: 0 });
    setOutputPath("");
    setError(null);
    setIsTrimming(false);
    setIsDetachingVideoForOverwrite(false);
    setShowInfo(false);
    setShowShortcuts(false);
    window.trimApi.getRecentFiles().then(setRecentFiles);
  }, []);

  const showShortcutsRef = useRef(showShortcuts);
  showShortcutsRef.current = showShortcuts;

  const handleEscape = useCallback(() => {
    if (showShortcutsRef.current) {
      setShowShortcuts(false);
    } else {
      closeVideo();
    }
  }, [closeVideo]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    togglePlay,
    seek,
    currentTime,
    trimStart: startSeconds,
    trimEnd: endSeconds,
    duration,
    frameDuration,
    videoRef,
    onTrimStartChange: handleTrimStartChange,
    onTrimEndChange: handleTrimEndChange,
    onToggleInfo: handleToggleInfo,
    onToggleShortcuts: handleToggleShortcuts,
    onCloseVideo: handleEscape,
    onCaptureFrame: () => { void captureFrame(); },
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const filePath = window.trimApi.getDroppedFilePath(file);
    if (!filePath) return;

    const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      setError("Unsupported file format. Supported: MP4, MOV, MKV, WebM, AVI, M4V.");
      return;
    }

    void loadVideo(filePath);
  }, [loadVideo]);

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
    <main
      className={`app-shell${isDragOver ? " drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {/* Titlebar drag region */}
      <div className="titlebar-drag-region">
        {probe && (
          <button
            type="button"
            className="back-button"
            onClick={closeVideo}
            aria-label="Close video"
            title="Close video (Esc)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>
        )}
        <span className="titlebar-version">TRIM (v{__APP_VERSION__})</span>
        {showInfo && probe && (
          <span className="titlebar-info">{probe.frameRate.toFixed(2)} fps | {probe.width}x{probe.height}</span>
        )}
      </div>

      {!probe && (
        <div className="empty-state">
          <p className="empty-state-message">Open a video to trim</p>
          <button type="button" className="action-button-primary" onClick={handleOpenVideo}>
            Open Video
          </button>
          <p className="empty-state-hint">or drag & drop a video file</p>
          {recentFiles.length > 0 && (
            <div className="recent-files">
              <h3 className="recent-files-title">Recent Files</h3>
              <ul className="recent-files-list">
                {recentFiles.map((filePath) => (
                  <li key={filePath}>
                    <button
                      type="button"
                      className="recent-file-button"
                      onClick={() => void loadVideo(filePath)}
                      title={filePath}
                    >
                      <span className="recent-file-name">{fileName(filePath)}</span>
                      <span className="recent-file-dir">{parentDir(filePath)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          onCaptureFrame={() => { void captureFrame(); }}
          isCapturingFrame={isCapturingFrame}
          frameCaptureSuccess={frameCaptureSuccess}
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
          videoSrc={videoSrc}
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

      {(pendingUpdate || downloadProgress !== null || updateReady) && !dismissedUpdate && (
        <div className={`update-notification${updateReady ? " update-notification-ready" : ""}`}>
          <div className="update-notification-header">
            <div className="update-notification-icon">
              {updateReady ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v13M12 16l-5-5M12 16l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div className="update-notification-text">
              {updateReady ? (
                <>
                  <div className="update-notification-title">v{updateReady} ready to install</div>
                  <div className="update-notification-subtitle">Restart to apply the update</div>
                </>
              ) : downloadProgress !== null ? (
                <>
                  <div className="update-notification-title">Downloading update</div>
                  <div className="update-notification-subtitle">v{pendingUpdate}</div>
                </>
              ) : (
                <>
                  <div className="update-notification-title">Update available</div>
                  <div className="update-notification-subtitle">v{pendingUpdate} is ready to download</div>
                </>
              )}
            </div>
            {downloadProgress === null && (
              <button
                type="button"
                className="update-notification-dismiss"
                onClick={() => setDismissedUpdate(true)}
                aria-label="Dismiss"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          <div className="update-notification-body">
            {downloadProgress !== null && !updateReady && (
              <div className="update-notification-progress">
                <div className="update-notification-progress-row">
                  <span className="update-notification-progress-label">Downloading...</span>
                  <span className="update-notification-percent">{downloadProgress}%</span>
                </div>
                <div className="update-notification-track">
                  <div className="update-notification-fill" style={{ width: `${downloadProgress}%` }} />
                </div>
              </div>
            )}

            {downloadProgress === null && (
              <div className="update-notification-actions">
                {updateReady ? (
                  <button
                    type="button"
                    className="update-notification-btn"
                    onClick={() => window.trimApi.installUpdate()}
                  >
                    Restart & Install
                  </button>
                ) : (
                  <button
                    type="button"
                    className="update-notification-btn"
                    onClick={() => { setDownloadProgress(0); void window.trimApi.downloadUpdate(); }}
                  >
                    Update
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {showShortcuts && <ShortcutsOverlay onClose={handleToggleShortcuts} />}
    </main>
  );
}
