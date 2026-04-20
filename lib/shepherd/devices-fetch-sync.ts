import { getShepherdConfig } from "./config"
import { syncShepherdFleet } from "./sync"

let lastSyncAt = 0

/**
 * When Shepherd is configured, run a fleet sync before listing devices so GET /api/devices
 * returns real vehicles instead of an empty DB / stale store (which makes the UI use sample data).
 *
 * `SHEPHERD_DEVICES_FETCH_SYNC_MS` — min milliseconds between syncs (default 25000). Set to `0` to sync on every GET. Set to `-1` to disable sync-on-fetch (use boot sync + POST /api/shepherd/sync + interval only).
 */
export async function maybeSyncShepherdBeforeDevicesFetch(): Promise<void> {
  const cfg = getShepherdConfig()
  if (!cfg.enabled) return

  const raw = process.env.SHEPHERD_DEVICES_FETCH_SYNC_MS
  const cooldown = raw === undefined || raw === "" ? 25_000 : parseInt(raw, 10)
  if (Number.isNaN(cooldown) || cooldown < 0) {
    return
  }

  const now = Date.now()
  if (cooldown > 0 && lastSyncAt > 0 && now - lastSyncAt < cooldown) {
    return
  }

  lastSyncAt = now
  try {
    const result = await syncShepherdFleet()
    if (result.synced === 0 && result.errors.length > 0) {
      console.warn("[Shepherd] devices fetch sync:", result.errors.join("; "))
    }
  } catch (e) {
    console.error("[Shepherd] devices fetch sync failed:", e)
  }
}
