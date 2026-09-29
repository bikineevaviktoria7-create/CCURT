// Copies MediaPipe WASM runtime into public/ so the app never depends on a CDN for it.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = join(root, "public", "mediapipe", "wasm");

if (!existsSync(source)) {
  console.warn("[mediapipe] пакет не установлен, копирование пропущено");
  process.exit(0);
}
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log("[mediapipe] WASM скопирован в public/mediapipe/wasm");
