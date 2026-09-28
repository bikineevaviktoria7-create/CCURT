import assert from "node:assert/strict";
import { test } from "node:test";
import * as storageModule from "../src/lib/storage.ts";
import * as progressModule from "../src/services/progressService.ts";
import { loadBrowserModule } from "./helpers/loadBrowserModule.ts";
import type { LessonResult } from "../src/types/progress.ts";

const result = (id: string): LessonResult => progressModule.calculateLessonResult("1", [{
  gestureId: "letter-1", mode: "real", success: true, skipped: false, durationMs: 1200, errorCodes: [],
}], Date.now() - 1200, id);

function service(upsert: (row: { id: string }) => Promise<{ error: { message: string } | null }>) {
  storageModule.storage.write("pending-sync", []);
  return loadBrowserModule<typeof import("../src/services/syncService.ts")>("src/services/syncService.ts", {
    "../app/constants": { MOCK_AUTH_ENABLED: false },
    "./accessService": { canReadProgress: () => true },
    "../lib/storage": storageModule,
    "../lib/supabase": { supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: "user" } } }, error: null }) },
      from: () => ({ upsert }),
    } },
    "./progressService": progressModule,
  }).syncService;
}

test("one sync loop drains items added during an in-flight upload", async () => {
  const sent: string[] = [];
  let release!: () => void;
  let entered!: () => void;
  const firstStarted = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let inFlight = 0;
  let peak = 0;
  const sync = service(async ({ id }) => {
    peak = Math.max(peak, ++inFlight);
    sent.push(id);
    if (id === "first") { entered(); await gate; }
    inFlight -= 1;
    return { error: null };
  });
  sync.push("user", result("first"));
  await firstStarted;
  const pending = sync.flush();
  sync.push("user", result("second"));
  assert.equal(sync.flush(), pending);
  release();
  await pending;
  assert.deepEqual(sent, ["first", "second"]);
  assert.equal(peak, 1);
  assert.equal((storageModule.storage.read("pending-sync") as unknown[]).length, 0);
});

for (const throws of [false, true]) {
  test(`sync failure (${throws ? "exception" : "response"}) keeps queued items for retry`, async () => {
    let fail = true;
    const sent: string[] = [];
    const sync = service(async ({ id }) => {
      if (fail) {
        if (throws) throw new Error("Offline");
        return { error: { message: "Offline" } };
      }
      sent.push(id);
      return { error: null };
    });
    sync.push("user", result("retry"));
    await sync.flush();
    assert.equal((storageModule.storage.read("pending-sync") as unknown[]).length, 1);
    fail = false;
    await sync.flush();
    assert.deepEqual(sent, ["retry"]);
    assert.equal((storageModule.storage.read("pending-sync") as unknown[]).length, 0);
  });
}

test("demo results and corrupted persisted queue entries never reach Supabase", async () => {
  const sent: string[] = [];
  const sync = service(async ({ id }) => { sent.push(id); return { error: null }; });
  const demo = result("demo");
  demo.attempts[0]!.mode = "demo";
  sync.push("user", demo);
  storageModule.storage.write("pending-sync", [{ userId: "user", result: demo }, { userId: "user", result: {} }]);
  await sync.flush();
  assert.deepEqual(sent, []);
});
