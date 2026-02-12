import type { ReactElement } from "react";

type TrimControlsProps = {
  duration: number;
  start: number;
  end: number;
  disabled?: boolean;
  onChangeStart: (value: number) => void;
  onChangeEnd: (value: number) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatMmSs(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function TrimControls(props: TrimControlsProps): ReactElement {
  const { duration, start, end, disabled, onChangeStart, onChangeEnd } = props;
  const max = Math.max(0.01, duration);
  const safeStart = clamp(start, 0, Math.max(0, end - 0.01));
  const safeEnd = clamp(end, Math.min(max, safeStart + 0.01), max);
  const startPercent = (safeStart / max) * 100;
  const endPercent = (safeEnd / max) * 100;
  const selectedPercent = Math.max(0, endPercent - startPercent);
  const selectedDuration = Math.max(0, safeEnd - safeStart);

  return (
    <section className="trim-controls">
      <div className="slider-shell">
        <div className="slider-value start-value" style={{ left: `${startPercent}%` }}>
          {formatMmSs(safeStart)}
        </div>
        <div className="slider-value end-value" style={{ left: `${endPercent}%` }}>
          {formatMmSs(safeEnd)}
        </div>
        <div className="range-track" />
        <div
          className="range-track selected-track"
          style={{ left: `${startPercent}%`, width: `${selectedPercent}%` }}
        />
        <input
          id="trim-start-range"
          className="range-input range-start"
          type="range"
          min={0}
          max={Math.max(0, safeEnd - 0.01)}
          step={0.01}
          value={safeStart}
          disabled={disabled}
          onChange={(event) => onChangeStart(Number(event.target.value))}
          aria-label="Trim start"
        />
        <input
          id="trim-end-range"
          className="range-input range-end"
          type="range"
          min={Math.min(max, safeStart + 0.01)}
          max={max}
          step={0.01}
          value={safeEnd}
          disabled={disabled}
          onChange={(event) => onChangeEnd(Number(event.target.value))}
          aria-label="Trim end"
        />
      </div>
      <p className="selected-duration">{formatMmSs(selectedDuration)} selected</p>
    </section>
  );
}
