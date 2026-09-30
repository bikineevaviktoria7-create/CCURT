import * as storageModule from "../../../src/lib/storage.ts";
import * as progressModule from "../../../src/services/progressService.ts";
import { loadBrowserModule } from "./loadBrowserModule.ts";

/** Empties the sync queue and loads `syncService` with a signed-in Supabase double that sends rows to `upsert`. */
export function loadSyncService(upsert: (row: { id: string }) => Promise<{ error: { message: string } | null }>) {
  storageModule.storage.write("pending-sync", []);
  return loadBrowserModule<typeof import("../../../src/services/syncService.ts")>("src/services/syncService.ts", {
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
