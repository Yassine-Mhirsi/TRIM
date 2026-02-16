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
};

export default function VideoPlayer(props: VideoPlayerProps): ReactElement {
  const { src, videoRef, isPlaying, playbackSpeed, volume, isMuted, onTogglePlay, onSpeedChange, onVolumeChange, onToggleMute } = props;

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
      </div>
      <SpeedControl speed={playbackSpeed} onSpeedChange={onSpeedChange} />
    </div>
  );
}
