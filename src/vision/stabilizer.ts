import type { GestureErrorCode } from "../types/vision.ts";

/**
 * A static gesture counts only when it wins most recent frames and is held for a
 * moment — no accidental success from one lucky frame.
 */
export class HoldStabilizer {
  private window: boolean[] = [];
  private held = 0;
  private lastTime = 0;
  private readonly size: number;
  private readonly required: number;
  private readonly holdMs: number;

  constructor(size = 12, required = 8, holdMs = 600) {
    this.size = size;
    this.required = required;
    this.holdMs = holdMs;
  }

  reset() {
    this.window = [];
    this.held = 0;
    this.lastTime = 0;
  }

  push(match: boolean, now: number) {
    this.window.push(match);
    if (this.window.length > this.size) this.window.shift();
    const hits = this.window.filter(Boolean).length;
    const elapsed = this.lastTime ? Math.min(150, now - this.lastTime) : 0;
    this.lastTime = now;
    if (match && hits >= this.required) this.held += elapsed;
    else if (hits < this.required - 3) this.held = 0;
    const progress = Math.min(1, this.held / this.holdMs);
    return { progress, success: progress >= 1, stableRatio: hits / this.size };
  }
}

/**
 * Keeps the hint steady: shows the most frequent recent mistake and changes the
 * text at most once per `minMs`, so it does not flicker between frames.
 */
export class HintSelector<T extends { code: GestureErrorCode; message: string }> {
  private history: (T | undefined)[] = [];
  private current: T | undefined;
  private changedAt = 0;
  private readonly size: number;
  private readonly minMs: number;

  constructor(size = 10, minMs = 1200) {
    this.size = size;
    this.minMs = minMs;
  }

  reset() {
    this.history = [];
    this.current = undefined;
    this.changedAt = 0;
  }

  push(hint: T | undefined, now: number) {
    this.history.push(hint);
    if (this.history.length > this.size) this.history.shift();
    const counts = new Map<string, { hint: T; count: number }>();
    for (const item of this.history) {
      if (!item) continue;
      const entry = counts.get(item.message) ?? { hint: item, count: 0 };
      entry.count += 1;
      counts.set(item.message, entry);
    }
    const leader = [...counts.values()].sort((a, b) => b.count - a.count)[0];
    if (!this.current || (leader && now - this.changedAt >= this.minMs && leader.hint.message !== this.current.message)) {
      if (leader) {
        this.current = leader.hint;
        this.changedAt = now;
      }
    }
    return this.current;
  }
}
