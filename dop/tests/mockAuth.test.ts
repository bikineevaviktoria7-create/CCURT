import assert from "node:assert/strict";
import { test } from "node:test";
import { MOCK_PASSWORD, MOCK_USERS } from "../../src/app/constants.ts";
import { getCurrentUser } from "../../src/services/accessService.ts";
import { isRecord, storage } from "../../src/lib/storage.ts";
import { calculateLessonResult, progressService } from "../../src/services/progressService.ts";
import { loadBrowserModule } from "./helpers/loadBrowserModule.ts";
import type { authService as AuthService } from "../../src/services/authService.ts";

const { authService } = loadBrowserModule<{ authService: typeof AuthService }>("src/services/authService.ts", {
  "../app/constants": { MOCK_PASSWORD, MOCK_USERS },
  "../lib/storage": { isRecord, storage },
  "./accessService": { getCurrentUser },
});

test("all three accounts log in, restore distinct identities and reject invalid credentials", async () => {
  assert.equal(new Set(MOCK_USERS.map(user => user.id)).size, 3);
  for (const account of MOCK_USERS) {
    const user = await authService.login({ email: account.name, password: MOCK_PASSWORD });
    assert.equal(user.id, account.id);
    assert.equal((await authService.initialize())?.name, account.name);
    await assert.rejects(authService.login({ email: account.name, password: "wrong" }));
    authService.logout();
    assert.equal(getCurrentUser(), null);
  }
  await assert.rejects(authService.login({ email: "Незнакомец", password: MOCK_PASSWORD }));
});

test("switching demo users keeps lesson progress separate and preserves Ruslana's existing ID", async () => {
  assert.equal(MOCK_USERS[0].id, "mock-ruslana");
  const result = calculateLessonResult("1", [{ gestureId: "letter-1", mode: "real", success: true, skipped: false, confidence: 1, errorCodes: [], durationMs: 1500 }], Date.now(), "demo-login-test");
  await authService.login({ email: MOCK_USERS[0].name, password: MOCK_PASSWORD });
  progressService.completeLesson(MOCK_USERS[0].id, result);
  await authService.login({ email: MOCK_USERS[1].name, password: MOCK_PASSWORD });
  assert.equal(progressService.getProgress(MOCK_USERS[1].id).lessons["1"], undefined);
  await authService.login({ email: MOCK_USERS[0].name, password: MOCK_PASSWORD });
  assert.ok(progressService.getProgress(MOCK_USERS[0].id).lessons["1"]);
});
