import { MOCK_CREDENTIALS } from "../../src/app/constants.ts";
import { storage } from "../../src/lib/storage.ts";
export const accountId = MOCK_CREDENTIALS.userId;
export function setMockAccount() {
  storage.write("user", { id: accountId, name: MOCK_CREDENTIALS.login, isGuest: false, authProvider: "mock", role: "user" });
  storage.remove(`progress:${accountId}`);
}
