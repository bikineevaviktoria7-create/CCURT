import assert from "node:assert/strict";
import { test } from "node:test";
import { loadBrowserModule } from "./helpers/loadBrowserModule.ts";
import type { SettingsService as SettingsServiceClass } from "../../src/services/settingsService.ts";

type SettingsModule = { SettingsService: typeof SettingsServiceClass };

function createService(saved: Record<string, unknown>) {
  const { SettingsService } = loadBrowserModule<SettingsModule>("src/services/settingsService.ts", {
    react: { useSyncExternalStore: () => undefined },
    "../lib/storage": {
      isRecord: (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value),
      storage: { read: () => undefined, write: () => {} },
    },
  });
  return new SettingsService({ read: (key: string) => saved[key], write: () => {} });
}

test("tolerance override outside (0, 5] falls back to default", () => {
  for (const value of [1e9, Number.NaN, -1, 0, Infinity, "2"]) {
    assert.equal(createService({ "recognition-tolerance": value }).toleranceOverride(), null);
  }
  assert.equal(createService({ "recognition-tolerance": 1.5 }).toleranceOverride(), 1.5);
});

test("stored settings with wrong field types fall back to defaults", () => {
  const settings = createService({
    settings: { dominantHand: "up", soundEnabled: "yes", speechEnabled: false, calibrationCompleted: 1 },
  }).get();
  assert.deepEqual({ ...settings }, { dominantHand: "right", soundEnabled: true, speechEnabled: false, calibrationCompleted: false });
});
