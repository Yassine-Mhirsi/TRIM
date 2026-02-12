import type { ReactElement } from "react";
import { formatTimestamp } from "../utils/time";

type PlaybackControlsProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
};

export default function PlaybackControls(props: PlaybackControlsProps): ReactElement {
  const { isPlaying, currentTime, duration, onTogglePlay } = props;

  return (
    <div className="playback-controls">
      <button
        type="button"
        className="play-pause-button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        )}
      </button>
      <span className="playback-time">
        {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
      </span>
    </div>
  );
}
