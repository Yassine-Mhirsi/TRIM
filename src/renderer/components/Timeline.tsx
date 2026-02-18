import { useRef, type ReactElement } from "react";
import { useTimelineDrag } from "../hooks/useTimelineDrag";
import { useTimelineThumbnail } from "../hooks/useTimelineThumbnail";
import { formatTimestamp, formatPrecise } from "../utils/time";

type TimelineProps = {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  disabled: boolean;
  onSeek: (time: number) => void;
  onTrimStartChange: (value: number) => void;
  onTrimEndChange: (value: number) => void;
  videoSrc: string | null;
};

export default function Timeline(props: TimelineProps): ReactElement {
  const {
    duration,
    currentTime,
    trimStart,
    trimEnd,
    disabled,
    onSeek,
    onTrimStartChange,
    onTrimEndChange,
    videoSrc,
  } = props;

  const timelineRef = useRef<HTMLDivElement>(null);

  const { activeDrag, dragTime, onPointerDownStart, onPointerDownEnd, onPointerDownTrack } =
    useTimelineDrag({
      timelineRef,
      duration,
      trimStart,
      trimEnd,
      onSeek,
      onTrimStartChange,
      onTrimEndChange,
      disabled,
    });

  const { thumbnailDataUrl, hoverTime, tooltipLeftPercent, isVisible, onMouseMove, onMouseLeave } =
    useTimelineThumbnail({ timelineRef, duration, videoSrc, activeDrag, disabled });

  const safeMax = Math.max(0.01, duration);
  const startPercent = (trimStart / safeMax) * 100;
  const endPercent = (trimEnd / safeMax) * 100;
  const playheadPercent = (currentTime / safeMax) * 100;

  return (
    <section className="timeline-section">
      {/* Time labels row */}
      <div className="timeline-time-row">
        <span>{formatTimestamp(currentTime)}</span>
        <span>{formatTimestamp(duration)}</span>
      </div>

      {/* The timeline bar */}
      <div
        className={`timeline-track-container${disabled ? " disabled" : ""}`}
        ref={timelineRef}
        onPointerDown={onPointerDownTrack}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {/* Layer 1: Base track */}
        <div className="timeline-track-base" />

        {/* Layer 2: Dimmed left region (0 → trimStart) */}
        <div
          className="timeline-dim timeline-dim-left"
          style={{ width: `${startPercent}%` }}
        />

        {/* Layer 3: Dimmed right region (trimEnd → end) */}
        <div
          className="timeline-dim timeline-dim-right"
          style={{ width: `${100 - endPercent}%` }}
        />

        {/* Layer 4: Selected/trim region */}
        <div
          className="timeline-selected"
          style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
        />

        {/* Layer 5: Playhead */}
        <div
          className="timeline-playhead"
          style={{ left: `${playheadPercent}%` }}
        />

        {/* Layer 6: Start handle */}
        <div
          className={`timeline-handle timeline-handle-start${activeDrag === "start" ? " active" : ""}`}
          style={{ left: `${startPercent}%` }}
          onPointerDown={onPointerDownStart}
        >
          <div className="timeline-handle-grip" />
          {activeDrag === "start" && dragTime !== null && (
            <div className="timeline-handle-tooltip">{formatPrecise(dragTime)}</div>
          )}
        </div>

        {/* Layer 7: End handle */}
        <div
          className={`timeline-handle timeline-handle-end${activeDrag === "end" ? " active" : ""}`}
          style={{ left: `${endPercent}%` }}
          onPointerDown={onPointerDownEnd}
        >
          <div className="timeline-handle-grip" />
          {activeDrag === "end" && dragTime !== null && (
            <div className="timeline-handle-tooltip">{formatPrecise(dragTime)}</div>
          )}
        </div>

        {/* Layer 8: Thumbnail tooltip */}
        {isVisible && hoverTime !== null && (
          <div
            className="timeline-thumbnail-tooltip"
            style={{ left: `${tooltipLeftPercent}%` }}
            aria-hidden="true"
          >
            {thumbnailDataUrl ? (
              <img
                className="timeline-thumbnail-image"
                src={thumbnailDataUrl}
                width={160}
                height={90}
                alt=""
                draggable={false}
              />
            ) : (
              <div className="timeline-thumbnail-placeholder" />
            )}
            <span className="timeline-thumbnail-time">{formatPrecise(hoverTime)}</span>
          </div>
        )}
      </div>

      {/* Trim range labels */}
      <div className="timeline-trim-labels">
        <span>{formatTimestamp(trimStart)}</span>
        <span className="timeline-trim-duration">
          Selection: {formatTimestamp(trimEnd - trimStart)}
        </span>
        <span>{formatTimestamp(trimEnd)}</span>
      </div>
    </section>
  );
}
