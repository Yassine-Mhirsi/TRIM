import type { ReactElement, RefObject } from "react";
import SpeedControl from "./SpeedControl";
import VolumeControl from "./VolumeControl";

type VideoPlayerProps = {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onCaptureFrame: () => void;
  isCapturingFrame: boolean;
  frameCaptureSuccess: boolean;
};

export default function VideoPlayer(props: VideoPlayerProps): ReactElement {
  const { src, videoRef, isPlaying, playbackSpeed, volume, isMuted, onTogglePlay, onSpeedChange, onVolumeChange, onToggleMute, onCaptureFrame, isCapturingFrame, frameCaptureSuccess } = props;

  return (
    <div className="video-player-row">
      <div className="video-player-container" onClick={onTogglePlay}>
        <video
          ref={videoRef}
          className="video-preview"
          src={src}
          preload="auto"
        >
          <track kind="captions" />
        </video>
        {!isPlaying && (
          <div className="video-play-overlay" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          </div>
        )}
        <div className="video-bottom-controls" onClick={(e) => e.stopPropagation()}>
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={onVolumeChange}
            onToggleMute={onToggleMute}
          />
        </div>
        <div className="video-capture-controls" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`video-capture-button${frameCaptureSuccess ? " video-capture-button-success" : ""}`}
            onClick={onCaptureFrame}
            disabled={isCapturingFrame}
            aria-label="Save current frame as PNG"
            title="Save current frame as PNG (S)"
          >
            {isCapturingFrame ? (
              <span className="spinner" aria-label="Saving frame..." />
            ) : frameCaptureSuccess ? (
              <svg className="capture-success-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="13" r="4" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      <SpeedControl speed={playbackSpeed} onSpeedChange={onSpeedChange} />
    </div>
  );
}
