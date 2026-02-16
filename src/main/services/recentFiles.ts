import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MAX_RECENT = 10;
const STORE_FILE = path.join(app.getPath("userData"), "recent-files.json");

function readStore(): string[] {
  try {
    if (!existsSync(STORE_FILE)) return [];
    const data: unknown = JSON.parse(readFileSync(STORE_FILE, "utf-8"));
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStore(files: string[]): void {
  try {
    writeFileSync(STORE_FILE, JSON.stringify(files), "utf-8");
  } catch {
    // silently ignore write failures
  }
}

export function getRecentFiles(): string[] {
  const all = readStore();
  const existing = all.filter((f) => existsSync(f));
  if (existing.length !== all.length) {
    writeStore(existing);
  }
  return existing;
}

export function addRecentFile(filePath: string): void {
  const normalized = path.resolve(filePath);
  const current = readStore();
  const updated = [normalized, ...current.filter((f) => f !== normalized)].slice(0, MAX_RECENT);
  writeStore(updated);
}
