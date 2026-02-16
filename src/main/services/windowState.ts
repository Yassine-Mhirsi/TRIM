import { app, screen } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type WindowBounds = { x: number; y: number; width: number; height: number };

const STORE_FILE = path.join(app.getPath("userData"), "window-state.json");

function isVisibleOnAnyDisplay(bounds: WindowBounds): boolean {
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    // Check that at least part of the window overlaps the display
    return (
      bounds.x < x + width &&
      bounds.x + bounds.width > x &&
      bounds.y < y + height &&
      bounds.y + bounds.height > y
    );
  });
}

export function getWindowState(): WindowBounds | null {
  try {
    if (!existsSync(STORE_FILE)) return null;
    const data: unknown = JSON.parse(readFileSync(STORE_FILE, "utf-8"));
    if (
      typeof data === "object" &&
      data !== null &&
      "x" in data &&
      "y" in data &&
      "width" in data &&
      "height" in data &&
      typeof (data as WindowBounds).x === "number" &&
      typeof (data as WindowBounds).y === "number" &&
      typeof (data as WindowBounds).width === "number" &&
      typeof (data as WindowBounds).height === "number"
    ) {
      const bounds = data as WindowBounds;
      if (bounds.width < 640 || bounds.height < 480) return null;
      if (!isVisibleOnAnyDisplay(bounds)) return null;
      return bounds;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveWindowState(bounds: WindowBounds): void {
  try {
    writeFileSync(STORE_FILE, JSON.stringify(bounds), "utf-8");
  } catch {
    // silently ignore write failures
  }
}
