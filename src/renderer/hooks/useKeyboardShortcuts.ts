import { useEffect, useRef } from "react";
import { clamp } from "../utils/math";

type UseKeyboardShortcutsOptions = {
  togglePlay: () => void;
  seek: (time: number) => void;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  frameDuration: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTrimStartChange: (time: number) => void;
  onTrimEndChange: (time: number) => void;
  onToggleInfo: () => void;
  disabled: boolean;
};

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const {
    togglePlay,
    seek,
    currentTime,
    trimStart,
    trimEnd,
    duration,
    frameDuration,
    videoRef,
    onTrimStartChange,
    onTrimEndChange,
    onToggleInfo,
    disabled,
  } = options;

  // Use ref for currentTime to avoid re-attaching listener on every frame
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);
  trimStartRef.current = trimStart;
  trimEndRef.current = trimEnd;

  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent): void => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case " ": {
          e.preventDefault();
          togglePlay();
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const video = videoRef.current;
          if (video && !video.paused) video.pause();
          seek(clamp(currentTimeRef.current - frameDuration, 0, duration));
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const video = videoRef.current;
          if (video && !video.paused) video.pause();
          seek(clamp(currentTimeRef.current + frameDuration, 0, duration));
          break;
        }
        case "[": {
          e.preventDefault();
          onTrimStartChange(currentTimeRef.current);
          break;
        }
        case "]": {
          e.preventDefault();
          onTrimEndChange(currentTimeRef.current);
          break;
        }
        case "i":
        case "I": {
          e.preventDefault();
          onToggleInfo();
          break;
        }
case "Home": {
          e.preventDefault();
          seek(trimStartRef.current);
          break;
        }
        case "End": {
          e.preventDefault();
          seek(trimEndRef.current);
          break;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [disabled, togglePlay, seek, duration, frameDuration, videoRef, onTrimStartChange, onTrimEndChange, onToggleInfo]);
}
