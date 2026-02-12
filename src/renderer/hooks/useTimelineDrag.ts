import { useCallback, useRef, useState } from "react";
import { clamp, TRIM_EPSILON_SECONDS } from "../utils/math";

export type DragTarget = "start" | "end" | "playhead" | null;

type UseTimelineDragOptions = {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  trimStart: number;
  trimEnd: number;
  onSeek: (time: number) => void;
  onTrimStartChange: (time: number) => void;
  onTrimEndChange: (time: number) => void;
  disabled: boolean;
};

type UseTimelineDragReturn = {
  activeDrag: DragTarget;
  dragTime: number | null;
  onPointerDownStart: (e: React.PointerEvent) => void;
  onPointerDownEnd: (e: React.PointerEvent) => void;
  onPointerDownTrack: (e: React.PointerEvent) => void;
};

export function useTimelineDrag(options: UseTimelineDragOptions): UseTimelineDragReturn {
  const {
    timelineRef,
    duration,
    trimStart,
    trimEnd,
    onSeek,
    onTrimStartChange,
    onTrimEndChange,
    disabled,
  } = options;

  const [activeDrag, setActiveDrag] = useState<DragTarget>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);

  // Refs to get latest values inside pointer event handlers without re-attaching
  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);
  const durationRef = useRef(duration);
  trimStartRef.current = trimStart;
  trimEndRef.current = trimEnd;
  durationRef.current = duration;

  const pointerToTime = useCallback(
    (clientX: number): number => {
      const el = timelineRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return ratio * durationRef.current;
    },
    [timelineRef]
  );

  const startDrag = useCallback(
    (e: React.PointerEvent, target: DragTarget): void => {
      if (disabled || e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const time = pointerToTime(e.clientX);
      setActiveDrag(target);
      setDragTime(time);

      // Apply initial value
      if (target === "start") {
        const clamped = clamp(time, 0, trimEndRef.current - TRIM_EPSILON_SECONDS);
        onTrimStartChange(clamped);
      } else if (target === "end") {
        const clamped = clamp(time, trimStartRef.current + TRIM_EPSILON_SECONDS, durationRef.current);
        onTrimEndChange(clamped);
      } else if (target === "playhead") {
        onSeek(time);
      }

      const onMove = (moveEvent: PointerEvent): void => {
        const t = pointerToTime(moveEvent.clientX);
        setDragTime(t);

        if (target === "start") {
          const clamped = clamp(t, 0, trimEndRef.current - TRIM_EPSILON_SECONDS);
          onTrimStartChange(clamped);
        } else if (target === "end") {
          const clamped = clamp(t, trimStartRef.current + TRIM_EPSILON_SECONDS, durationRef.current);
          onTrimEndChange(clamped);
        } else if (target === "playhead") {
          onSeek(t);
        }
      };

      const onUp = (): void => {
        setActiveDrag(null);
        setDragTime(null);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [disabled, pointerToTime, onSeek, onTrimStartChange, onTrimEndChange]
  );

  const onPointerDownStart = useCallback(
    (e: React.PointerEvent): void => startDrag(e, "start"),
    [startDrag]
  );

  const onPointerDownEnd = useCallback(
    (e: React.PointerEvent): void => startDrag(e, "end"),
    [startDrag]
  );

  const onPointerDownTrack = useCallback(
    (e: React.PointerEvent): void => {
      // Don't handle if the click is on a handle (those have their own handlers)
      if ((e.target as HTMLElement).closest(".timeline-handle")) return;
      startDrag(e, "playhead");
    },
    [startDrag]
  );

  return { activeDrag, dragTime, onPointerDownStart, onPointerDownEnd, onPointerDownTrack };
}
