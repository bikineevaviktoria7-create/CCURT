import assert from "node:assert/strict";
import { test } from "node:test";
import { drawHandSkeleton } from "../src/lib/drawHandSkeleton.ts";

for (const [width, height] of [[640, 480], [390, 390], [1024, 500]]) {
  test(`canvas mirrors coordinates and respects contain letterboxing at ${width}x${height}`, () => {
    const dots: { x: number; y: number; color: string }[] = [];
    const context = {
      fillStyle: "", clearRect() {}, beginPath() {}, fill() {}, moveTo() {}, lineTo() {}, stroke() {},
      arc(x: number, y: number) { dots.push({ x, y, color: this.fillStyle }); },
    };
    drawHandSkeleton({ ctx: context as unknown as CanvasRenderingContext2D,
      landmarks: [{ x: .25, y: .25, z: 0 }], width: width!, height: height!, mirrored: true,
      sourceWidth: 640, sourceHeight: 480, incorrectLandmarks: [0],
      colors: { neutral: "white", correct: "green", incorrect: "coral" },
    });
    const scale = Math.min(width! / 640, height! / 480);
    assert.deepEqual(dots, [{ x: (width! - 640 * scale) / 2 + .75 * 640 * scale, y: (height! - 480 * scale) / 2 + .25 * 480 * scale, color: "coral" }]);
  });
}
