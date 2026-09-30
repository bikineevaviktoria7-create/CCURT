import { MOCK_USERS } from "../../../src/app/constants.ts";
import { storage } from "../../../src/lib/storage.ts";

/** Id of the first mock account, used as the logged-in user in tests. */
export const accountId = MOCK_USERS[0].id;

/** Logs in the first mock account and clears its saved progress. */
export function setMockAccount() {
  storage.write("user", { id: accountId, name: MOCK_USERS[0].name, isGuest: false, authProvider: "mock", role: "user" });
  storage.remove(`progress:${accountId}`);
}
