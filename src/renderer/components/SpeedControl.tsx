import { useState, type ReactElement } from "react";

const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const MIN_SPEED = 0.25;
const MAX_SPEED = 2;
const STEP = 0.25;

type SpeedControlProps = {
  speed: number;
  onSpeedChange: (speed: number) => void;
};

export default function SpeedControl(props: SpeedControlProps): ReactElement {
  const { speed, onSpeedChange } = props;
  const [customValue, setCustomValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = parseFloat(e.target.value);
    onSpeedChange(val);
  };

  const handleCustomSubmit = (): void => {
    const parsed = parseFloat(customValue);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 16) {
      onSpeedChange(Math.round(parsed * 100) / 100);
    }
    setIsEditing(false);
    setCustomValue("");
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter") {
      handleCustomSubmit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setCustomValue("");
    }
  };

  // Calculate fill percentage for the vertical slider (bottom to top)
  const fillPercent = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;

  return (
    <div className="speed-control">
      {/* Custom speed input / label at top */}
      {isEditing ? (
        <input
          className="speed-custom-input"
          type="text"
          inputMode="decimal"
          value={customValue}
          placeholder={speed.toString()}
          autoFocus
          onChange={(e) => setCustomValue(e.target.value)}
          onBlur={handleCustomSubmit}
          onKeyDown={handleCustomKeyDown}
        />
      ) : (
        <button
          type="button"
          className="speed-label-button"
          onClick={() => {
            setCustomValue("");
            setIsEditing(true);
          }}
          title="Click to enter custom speed"
        >
          {speed === 1 ? "1x" : `${speed}x`}
        </button>
      )}

      {/* Vertical slider track */}
      <div className="speed-slider-wrapper">
        <div className="speed-slider-track">
          <div
            className="speed-slider-fill"
            style={{ height: `${fillPercent}%` }}
          />
          <div
            className="speed-slider-thumb"
            style={{ bottom: `${fillPercent}%` }}
          />
        </div>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <input
          className="speed-slider-input"
          type="range"
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={STEP}
          value={speed}
          onChange={handleSliderChange}
          aria-label="Playback speed"
        />
        {/* Tick marks */}
        <div className="speed-ticks">
          {SPEED_STEPS.map((tick) => (
            <div
              key={tick}
              className={`speed-tick${tick === speed ? " active" : ""}${tick === 1 ? " default" : ""}`}
              style={{ bottom: `${((tick - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100}%` }}
            >
              <span className="speed-tick-line" />
            </div>
          ))}
        </div>
      </div>

      {/* Min/max labels */}
      <span className="speed-bound-label">slow</span>
    </div>
  );
}
