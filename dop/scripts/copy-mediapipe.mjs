// Copies MediaPipe WASM runtime into public/ so the app never depends on a CDN for it.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_DIR = join(ROOT_DIR, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const TARGET_DIR = join(ROOT_DIR, "public", "mediapipe", "wasm");

if (!existsSync(SOURCE_DIR)) {
  console.warn("[mediapipe] пакет не установлен, копирование пропущено");
  process.exit(0);
}
mkdirSync(TARGET_DIR, { recursive: true });
cpSync(SOURCE_DIR, TARGET_DIR, { recursive: true });
console.log("[mediapipe] WASM скопирован в public/mediapipe/wasm");
