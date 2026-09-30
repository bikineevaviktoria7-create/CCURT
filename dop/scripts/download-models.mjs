// Downloads MediaPipe models into public/models (run once, then commit the files).
// Usage: npm run models
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL_URLS = {
  "hand_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};

await mkdir(join(ROOT_DIR, "public", "models"), { recursive: true });
for (const [name, url] of Object.entries(MODEL_URLS)) {
  const file = join(ROOT_DIR, "public", "models", name);
  const exists = await stat(file).then((info) => info.size > 0, () => false);
  if (exists) {
    console.log(`[models] ${name} уже есть`);
    continue;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(file, new Uint8Array(await response.arrayBuffer()));
  console.log(`[models] ${name} скачан`);
}
