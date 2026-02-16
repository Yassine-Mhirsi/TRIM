import { type ReactElement } from "react";

type VolumeControlProps = {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
};

function VolumeIcon({ volume, isMuted }: { volume: number; isMuted: boolean }): ReactElement {
  if (isMuted || volume === 0) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3.63 3.63a.75.75 0 0 1 1.06 0l15.68 15.68a.75.75 0 1 1-1.06 1.06L3.63 4.69a.75.75 0 0 1 0-1.06Z" />
        <path d="M11 4.82a.75.75 0 0 0-1.23-.58L5.8 7.5H3.25A1.75 1.75 0 0 0 1.5 9.25v5.5c0 .97.78 1.75 1.75 1.75H5.8l3.97 3.26A.75.75 0 0 0 11 19.18V4.82Z" />
      </svg>
    );
  }

  if (volume < 0.5) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11 4.82a.75.75 0 0 0-1.23-.58L5.8 7.5H3.25A1.75 1.75 0 0 0 1.5 9.25v5.5c0 .97.78 1.75 1.75 1.75H5.8l3.97 3.26A.75.75 0 0 0 11 19.18V4.82Z" />
        <path d="M14.3 9.18a.75.75 0 0 1 1.05.14 4.25 4.25 0 0 1 0 5.36.75.75 0 1 1-1.2-.9 2.75 2.75 0 0 0 0-3.46.75.75 0 0 1 .14-1.05Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11 4.82a.75.75 0 0 0-1.23-.58L5.8 7.5H3.25A1.75 1.75 0 0 0 1.5 9.25v5.5c0 .97.78 1.75 1.75 1.75H5.8l3.97 3.26A.75.75 0 0 0 11 19.18V4.82Z" />
      <path d="M14.3 9.18a.75.75 0 0 1 1.05.14 4.25 4.25 0 0 1 0 5.36.75.75 0 1 1-1.2-.9 2.75 2.75 0 0 0 0-3.46.75.75 0 0 1 .14-1.05Z" />
      <path d="M16.28 6.57a.75.75 0 0 1 1.06.09 8.25 8.25 0 0 1 0 10.68.75.75 0 1 1-1.15-.97 6.75 6.75 0 0 0 0-8.74.75.75 0 0 1 .09-1.06Z" />
    </svg>
  );
}

export default function VolumeControl(props: VolumeControlProps): ReactElement {
  const { volume, isMuted, onVolumeChange, onToggleMute } = props;

  const displayVolume = isMuted ? 0 : volume;
  const fillPercent = displayVolume * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onVolumeChange(parseFloat(e.target.value));
  };

  return (
    <div className="volume-control">
      <button
        type="button"
        className="volume-icon-button"
        onClick={onToggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
        title={isMuted ? "Unmute" : "Mute"}
      >
        <VolumeIcon volume={volume} isMuted={isMuted} />
      </button>
      <div className="volume-slider-popup">
        <div className="volume-slider-wrapper">
          <div className="volume-slider-track">
            <div
              className="volume-slider-fill"
              style={{ height: `${fillPercent}%` }}
            />
            <div
              className="volume-slider-thumb"
              style={{ bottom: `${fillPercent}%` }}
            />
          </div>
          <input
            className="volume-slider-input"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={displayVolume}
            onChange={handleSliderChange}
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
