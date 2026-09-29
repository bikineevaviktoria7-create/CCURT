import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_PASSWORD, DEMO_USERS } from "../../src/app/constants.ts";
import { currentUser } from "../../src/services/accessService.ts";
import { isRecord, storage } from "../../src/lib/storage.ts";
import { calculateLessonResult, progressService } from "../../src/services/progressService.ts";
import { loadBrowserModule } from "./helpers/loadBrowserModule.ts";
import type { authService as AuthService } from "../../src/services/authService";

const { authService } = loadBrowserModule<{ authService: typeof AuthService }>("src/services/authService.ts", {
  "../app/constants": { DEMO_PASSWORD, DEMO_USERS },
  "../lib/storage": { isRecord, storage },
  "./accessService": { currentUser },
});

test("all three accounts log in, restore distinct identities and reject invalid credentials", async () => {
  assert.equal(new Set(DEMO_USERS.map(user => user.id)).size, 3);
  for (const account of DEMO_USERS) {
    const user = await authService.login({ email: account.name, password: DEMO_PASSWORD });
    assert.equal(user.id, account.id);
    assert.equal((await authService.init())?.name, account.name);
    await assert.rejects(authService.login({ email: account.name, password: "wrong" }));
    authService.logout();
    assert.equal(currentUser(), null);
  }
  await assert.rejects(authService.login({ email: "Незнакомец", password: DEMO_PASSWORD }));
});

test("switching demo users keeps lesson progress separate and preserves Ruslana's existing ID", async () => {
  assert.equal(DEMO_USERS[0].id, "mock-ruslana");
  const result = calculateLessonResult("1", [{ gestureId: "letter-1", mode: "real", success: true, skipped: false, confidence: 1, errorCodes: [], durationMs: 1500 }], Date.now(), "demo-login-test");
  await authService.login({ email: DEMO_USERS[0].name, password: DEMO_PASSWORD });
  progressService.completeLesson(DEMO_USERS[0].id, result);
  await authService.login({ email: DEMO_USERS[1].name, password: DEMO_PASSWORD });
  assert.equal(progressService.getProgress(DEMO_USERS[1].id).lessons["1"], undefined);
  await authService.login({ email: DEMO_USERS[0].name, password: DEMO_PASSWORD });
  assert.ok(progressService.getProgress(DEMO_USERS[0].id).lessons["1"]);
});
