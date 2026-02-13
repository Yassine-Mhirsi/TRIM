import { useCallback, useEffect, useRef, useState } from "react";

type UseVideoPlayerOptions = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trimStart: number;
  trimEnd: number;
  duration: number;
  /** Pass the video src so effects re-run when the video element mounts/changes */
  src: string | null;
};

type UseVideoPlayerReturn = {
  currentTime: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackSpeed: number;
  togglePlay: () => void;
  seek: (timeSeconds: number) => void;
  setPlaybackSpeed: (speed: number) => void;
};

export function useVideoPlayer(options: UseVideoPlayerOptions): UseVideoPlayerReturn {
  const { videoRef, trimStart, trimEnd, duration, src } = options;

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);

  // Refs to avoid stale closures in RAF loop and event handlers
  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);
  const isPlayingRef = useRef(false);

  trimStartRef.current = trimStart;
  trimEndRef.current = trimEnd;

  // Sync video element events → React state
  // Re-runs when `src` changes so listeners attach after the <video> mounts
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = (): void => {
      setIsPlaying(true);
      isPlayingRef.current = true;
    };
    const onPause = (): void => {
      setIsPlaying(false);
      isPlayingRef.current = false;
    };
    const onEnded = (): void => {
      setIsPlaying(false);
      isPlayingRef.current = false;
    };
    const onWaiting = (): void => setIsBuffering(true);
    const onCanPlay = (): void => setIsBuffering(false);
    const onLoadedData = (): void => {
      setCurrentTime(0);
      setIsPlaying(false);
      isPlayingRef.current = false;
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onLoadedData);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onLoadedData);
    };
  }, [videoRef, src]);

  // RAF loop for smooth currentTime tracking + trim-constrained looping
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    let rafId = 0;

    const update = (): void => {
      if (!video) return;

      const t = video.currentTime;
      setCurrentTime(t);

      // Trim-constrained looping: when playback reaches trim end, loop to trim start
      if (isPlayingRef.current && t >= trimEndRef.current) {
        video.currentTime = trimStartRef.current;
        setCurrentTime(trimStartRef.current);
      }

      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying, videoRef, src]);

  // When trim bounds change while playing, ensure playhead stays in range
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlayingRef.current) return;

    if (video.currentTime < trimStart) {
      video.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  }, [trimStart, videoRef]);

  // Sync playback speed to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackSpeed;
  }, [playbackSpeed, videoRef, src]);

  const seek = useCallback(
    (timeSeconds: number): void => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(timeSeconds, duration));
      video.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [videoRef, duration]
  );

  const togglePlay = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // If current position is outside trim range, seek to trim start before playing
      const t = video.currentTime;
      if (t < trimStartRef.current || t >= trimEndRef.current) {
        video.currentTime = trimStartRef.current;
        setCurrentTime(trimStartRef.current);
      }
      void video.play();
    } else {
      video.pause();
    }
  }, [videoRef]);

  const setPlaybackSpeed = useCallback((speed: number): void => {
    setPlaybackSpeedState(speed);
  }, []);

  return { currentTime, isPlaying, isBuffering, playbackSpeed, togglePlay, seek, setPlaybackSpeed };
}
