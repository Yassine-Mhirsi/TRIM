import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../utils/math";

type DragTarget = "start" | "end" | "playhead" | null;

type Options = {
  timelineRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  videoSrc: string | null;
  activeDrag: DragTarget;
  disabled: boolean;
};

type Return = {
  thumbnailDataUrl: string | null;
  hoverTime: number | null;
  tooltipLeftPercent: number;
  isVisible: boolean;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
};

export function useTimelineThumbnail({
  timelineRef,
  duration,
  videoSrc,
  activeDrag,
  disabled,
}: Options): Return {
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSeeking = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const activeDragRef = useRef(activeDrag);
  activeDragRef.current = activeDrag;

  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [tooltipLeftPercent, setTooltipLeftPercent] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Setup hidden video + canvas when videoSrc changes
  useEffect(() => {
    if (!videoSrc) {
      hiddenVideoRef.current = null;
      canvasRef.current = null;
      return;
    }

    const video = document.createElement("video");
    video.src = videoSrc;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    hiddenVideoRef.current = video;

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    canvasRef.current = canvas;

    const onSeeked = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, 320, 180);
        setThumbnailDataUrl(canvas.toDataURL("image/jpeg", 0.85));
      }
      isSeeking.current = false;
      if (pendingSeekRef.current !== null) {
        const next = pendingSeekRef.current;
        pendingSeekRef.current = null;
        isSeeking.current = true;
        video.currentTime = next;
      }
    };

    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("seeked", onSeeked);
      hiddenVideoRef.current = null;
      canvasRef.current = null;
      isSeeking.current = false;
      pendingSeekRef.current = null;
    };
  }, [videoSrc]);

  // Hide tooltip immediately when any drag starts
  useEffect(() => {
    if (activeDrag !== null) {
      setIsVisible(false);
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    }
  }, [activeDrag]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || !videoSrc || !hiddenVideoRef.current) return;
      if (activeDragRef.current !== null) { setIsVisible(false); return; }

      const el = timelineRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const halfTooltipPx = 80; // half of 160px tooltip width
      // Clamp the visual anchor so tooltip never overflows the track container
      const clampedX = clamp(e.clientX - rect.left, halfTooltipPx, rect.width - halfTooltipPx);
      const hoverRatio = clamp((e.clientX - rect.left) / rect.width, 0, 1);

      setHoverTime(hoverRatio * duration);
      setTooltipLeftPercent((clampedX / rect.width) * 100);
      setIsVisible(true);

      const seekTarget = hoverRatio * duration;
      if (isSeeking.current) {
        pendingSeekRef.current = seekTarget;
      } else {
        if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
        debounceTimer.current = window.setTimeout(() => {
          debounceTimer.current = null;
          const video = hiddenVideoRef.current;
          if (!video) return;
          isSeeking.current = true;
          video.currentTime = seekTarget;
        }, 40);
      }
    },
    [disabled, videoSrc, duration, timelineRef]
  );

  const onMouseLeave = useCallback(() => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    setIsVisible(false);
    setHoverTime(null);
  }, []);

  return { thumbnailDataUrl, hoverTime, tooltipLeftPercent, isVisible, onMouseMove, onMouseLeave };
}
