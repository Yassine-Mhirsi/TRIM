import type { ReactElement, RefObject } from "react";
import SpeedControl from "./SpeedControl";

type VideoPlayerProps = {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
};

export default function VideoPlayer(props: VideoPlayerProps): ReactElement {
  const { src, videoRef, isPlaying, playbackSpeed, onTogglePlay, onSpeedChange } = props;

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
      </div>
      <SpeedControl speed={playbackSpeed} onSpeedChange={onSpeedChange} />
    </div>
  );
}
