// Downloads MediaPipe models into public/models (run once, then commit the files).
// Usage: npm run models
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const models = {
  "hand_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  "pose_landmarker_lite.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

await mkdir(join(root, "public", "models"), { recursive: true });
for (const [name, url] of Object.entries(models)) {
  const file = join(root, "public", "models", name);
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
