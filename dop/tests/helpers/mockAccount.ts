import { DEMO_USERS } from "../../../src/app/constants.ts";
import { storage } from "../../../src/lib/storage.ts";
export const accountId = DEMO_USERS[0].id;
export function setMockAccount() {
  storage.write("user", { id: accountId, name: DEMO_USERS[0].name, isGuest: false, authProvider: "mock", role: "user" });
  storage.remove(`progress:${accountId}`);
}
