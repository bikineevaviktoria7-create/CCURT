import assert from "node:assert/strict";
import { test } from "node:test";
import { localDb } from "../src/lib/localDb.ts";
import { storage } from "../src/lib/storage.ts";

test("failed localStorage removal does not restore stale data in this session", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const disk = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => disk.get(key) ?? null,
      setItem: (key: string, value: string) => disk.set(key, value),
      removeItem: () => { throw new Error("Storage unavailable"); },
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });

  storage.write("review-session", { id: "old-user" });
  storage.remove("review-session");
  assert.equal(storage.read("review-session"), undefined);
  assert.equal(storage.isPersistent(), false);
  storage.write("review-session", { id: "new-user" });
  assert.deepEqual(storage.read("review-session"), { id: "new-user" });
});

for (const outcome of ["success", "error", "abort", "throw"] as const) {
  test(`IndexedDB releases connections after ${outcome}`, async (t) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    let opened = 0;
    let closed = 0;
    const records = new Map<string, unknown>();
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: {
        open: () => {
          opened += 1;
          const request = {
            onsuccess: () => {},
            result: {
              close: () => { closed += 1; },
              transaction: () => {
                if (outcome === "throw") throw new Error("Database closed");
                const transaction = {
                  oncomplete: () => {},
                  onerror: () => {},
                  onabort: () => {},
                  objectStore: () => ({
                    put: (value: unknown, key: string) => {
                      queueMicrotask(() => {
                        if (outcome === "abort") transaction.onabort();
                        else if (outcome === "error") transaction.onerror();
                        else {
                          records.set(key, value);
                          transaction.oncomplete();
                        }
                      });
                    },
                    get: (key: string) => {
                      const read = { result: records.get(key), onsuccess: () => {}, onerror: () => {} };
                      queueMicrotask(() => outcome === "error" ? read.onerror() : read.onsuccess());
                      return read;
                    },
                  }),
                };
                return transaction;
              },
            },
          };
          queueMicrotask(() => request.onsuccess());
          return request;
        },
      },
    });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, "indexedDB", original);
      else Reflect.deleteProperty(globalThis, "indexedDB");
    });

    const key = `review-${outcome}`;
    if (outcome === "throw") {
      await assert.rejects(localDb.set(key, "sample"), /Database closed/);
      await assert.rejects(localDb.get(key), /Database closed/);
    } else {
      await localDb.set(key, "sample");
      assert.equal(await localDb.get(key), outcome === "abort" ? undefined : "sample");
    }
    assert.equal(opened, 2);
    assert.equal(closed, opened);
  });
}
