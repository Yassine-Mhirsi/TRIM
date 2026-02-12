import { existsSync } from "node:fs";
import { access, constants, rename, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
const ffprobeStatic = require("ffprobe-static") as { path: string };

const SUPPORTED_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".avi",
  ".m4v"
]);

export type VideoProbeResult = {
  durationSeconds: number;
  width: number;
  height: number;
  format: string;
};

export type TrimRequest = {
  jobId: string;
  inputPath: string;
  outputPath: string;
  startSeconds: number;
  endSeconds: number;
  mode: "smart" | "copy" | "reencode";
};

export type TrimResult = {
  ok: boolean;
  outputPath: string;
  usedMode: "copy" | "reencode";
  error?: string;
};

function makeOverwriteTempPath(inputPath: string, jobId: string): string {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.trim-${jobId}${parsed.ext}`);
}

function withAsarUnpacked(binaryPath: string): string {
  return binaryPath.replace("app.asar\\", "app.asar.unpacked\\").replace("app.asar/", "app.asar.unpacked/");
}

function resolveFfprobePath(): string {
  const arch = process.arch === "ia32" ? "ia32" : "x64";
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const packagedPath = resourcesPath
    ? path.join(resourcesPath, "ffprobe", "bin", "win32", arch, "ffprobe.exe")
    : "";
  if (existsSync(packagedPath)) {
    return packagedPath;
  }

  const modulePath = ffprobeStatic.path;
  if (!modulePath) {
    throw new Error("ffprobe binary was not found.");
  }

  if (existsSync(modulePath)) {
    return modulePath;
  }

  const unpackedPath = withAsarUnpacked(modulePath);
  if (existsSync(unpackedPath)) {
    return unpackedPath;
  }

  throw new Error(`ffprobe binary was not found at: ${modulePath}`);
}

function resolveFfmpegPath(): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const packagedPath = resourcesPath ? path.join(resourcesPath, "ffmpeg", "ffmpeg.exe") : "";
  if (existsSync(packagedPath)) {
    return packagedPath;
  }

  if (!ffmpegStatic) {
    throw new Error("ffmpeg binary was not found.");
  }

  if (existsSync(ffmpegStatic)) {
    return ffmpegStatic;
  }

  const unpackedPath = withAsarUnpacked(ffmpegStatic);
  if (existsSync(unpackedPath)) {
    return unpackedPath;
  }

  throw new Error(`ffmpeg binary was not found at: ${ffmpegStatic}`);
}

function timestampFromSeconds(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = seconds.toFixed(3).padStart(6, "0");
  return `${hh}:${mm}:${ss}`;
}

function parseProgressSeconds(raw: string): number | null {
  const match = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(raw);
  if (!match) {
    return null;
  }

  const [, hh, mm, ss] = match;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

export function isSupportedVideo(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export async function validateInputVideo(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    throw new Error("Selected file does not exist.");
  }

  if (!isSupportedVideo(filePath)) {
    throw new Error("Unsupported file extension for trimming.");
  }
}

export function suggestOutputPath(inputPath: string): string {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}_trimmed${parsed.ext}`);
}

export async function ensureWritableOutputPath(outputPath: string): Promise<void> {
  const outputDir = path.dirname(outputPath);
  await access(outputDir, constants.W_OK);
}

export async function findAvailableOutputPath(initialPath: string): Promise<string> {
  const parsed = path.parse(initialPath);
  let candidate = initialPath;
  let index = 1;

  while (existsSync(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name}_${index}${parsed.ext}`);
    index += 1;
  }

  return candidate;
}

export async function probeVideo(filePath: string): Promise<VideoProbeResult> {
  const ffprobePath = resolveFfprobePath();

  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath
    ];
    const child = spawn(ffprobePath, args, { windowsHide: true });
    let json = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      json += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error: Error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || "Failed to probe video metadata."));
        return;
      }

      try {
        const parsed = JSON.parse(json) as {
          format?: { duration?: string; format_name?: string };
          streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
        };
        const durationSeconds = Number(parsed.format?.duration ?? 0);
        const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video");
        resolve({
          durationSeconds,
          width: videoStream?.width ?? 0,
          height: videoStream?.height ?? 0,
          format: parsed.format?.format_name ?? "unknown"
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function trimWithMode(
  request: TrimRequest,
  mode: "copy" | "reencode",
  onProgress: (value: number) => void
): Promise<TrimResult> {
  const ffmpegPath = resolveFfmpegPath();

  const totalDuration = Math.max(0.001, request.endSeconds - request.startSeconds);
  const start = timestampFromSeconds(request.startSeconds);
  const end = timestampFromSeconds(request.endSeconds);

  const baseArgs = [
    "-hide_banner",
    "-y",
    "-ss",
    start,
    "-to",
    end,
    "-i",
    request.inputPath
  ];

  const modeArgs =
    mode === "copy" ? ["-c", "copy"] : ["-c:v", "libx264", "-c:a", "aac", "-preset", "fast"];

  const args = [...baseArgs, ...modeArgs, request.outputPath];

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      const progressSeconds = parseProgressSeconds(text);
      if (progressSeconds !== null) {
        const ratio = Math.max(0, Math.min(1, progressSeconds / totalDuration));
        onProgress(ratio);
      }
    });

    child.on("error", (error: Error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        onProgress(1);
        resolve({ ok: true, outputPath: request.outputPath, usedMode: mode });
      } else {
        resolve({
          ok: false,
          outputPath: request.outputPath,
          usedMode: mode,
          error: stderr || "ffmpeg failed to trim the video."
        });
      }
    });
  });
}

export async function trimVideo(
  request: TrimRequest,
  onProgress: (value: number) => void
): Promise<TrimResult> {
  if (request.startSeconds < 0 || request.endSeconds <= request.startSeconds) {
    throw new Error("Invalid trim range.");
  }

  await validateInputVideo(request.inputPath);
  await ensureWritableOutputPath(request.outputPath);

  if (request.mode === "copy") {
    return trimWithMode(request, "copy", onProgress);
  }

  if (request.mode === "reencode") {
    return trimWithMode(request, "reencode", onProgress);
  }

  const copyAttempt = await trimWithMode(request, "copy", onProgress);
  if (copyAttempt.ok) {
    return copyAttempt;
  }

  return trimWithMode(request, "reencode", onProgress);
}

export async function overwriteVideo(
  request: Omit<TrimRequest, "outputPath">,
  onProgress: (value: number) => void
): Promise<TrimResult> {
  await validateInputVideo(request.inputPath);
  await ensureWritableOutputPath(request.inputPath);

  const tempOutputPath = await findAvailableOutputPath(makeOverwriteTempPath(request.inputPath, request.jobId));
  const backupPath = await findAvailableOutputPath(`${request.inputPath}.bak`);

  const trimResult = await trimVideo(
    {
      ...request,
      outputPath: tempOutputPath
    },
    onProgress
  );

  if (!trimResult.ok) {
    return trimResult;
  }

  let originalMoved = false;
  try {
    await rename(request.inputPath, backupPath);
    originalMoved = true;
    await rename(tempOutputPath, request.inputPath);
    await rm(backupPath, { force: true });
    return { ...trimResult, outputPath: request.inputPath };
  } catch (error) {
    if (originalMoved && !existsSync(request.inputPath) && existsSync(backupPath)) {
      await rename(backupPath, request.inputPath);
    }
    await rm(tempOutputPath, { force: true });
    throw error;
  }
}
