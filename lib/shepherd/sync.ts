import { getShepherdConfig } from "./config"
import { shepherdRequestJson } from "./client"
import { extractVehiclesArray, mapShepherdVehicle } from "./mapper"
import { upsertDevice, updateDeviceStatus } from "@/lib/db-devices"
import { emitTelemetryUpdate } from "@/lib/socket-server"

export type ShepherdSyncResult = {
  ok: boolean
  synced: number
  skipped: number
  errors: string[]
  vehiclesPath: string
}

/**
 * Pull vehicles from Shepherd, upsert devices + telemetry, broadcast on Socket.IO.
 */
export async function syncShepherdFleet(): Promise<ShepherdSyncResult> {
  const cfg = getShepherdConfig()
  const errors: string[] = []
  let synced = 0
  let skipped = 0

  if (!cfg.enabled) {
    return {
      ok: false,
      synced: 0,
      skipped: 0,
      errors: ["Shepherd is not configured. Set SHEPHERD_BASE_URL and SHEPHERD_BASIC_USER/PASSWORD (or SHEPHERD_BASIC_AUTH)."],
      vehiclesPath: cfg.vehiclesPath,
    }
  }

  let payload: unknown
  try {
    payload = await shepherdRequestJson<unknown>(cfg.vehiclesPath, {
      method: cfg.vehiclesMethod,
      body: cfg.vehiclesMethod === "POST" ? {} : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      synced: 0,
      skipped: 0,
      errors: [msg],
      vehiclesPath: cfg.vehiclesPath,
    }
  }

  const list = extractVehiclesArray(payload)
  if (list.length === 0) {
    let hint = ""
    if (payload && typeof payload === "object") {
      const o = payload as Record<string, unknown>
      const keys = Object.keys(o)
      const dataField = o.data
      if (dataField !== undefined) {
        if (Array.isArray(dataField)) {
          hint = `'data' is array[${dataField.length}]`
          if (dataField.length > 0 && typeof dataField[0] === "object" && dataField[0] !== null) {
            hint += `, first item keys: ${Object.keys(dataField[0] as object).join(", ")}`
          }
        } else if (dataField && typeof dataField === "object") {
          hint = `'data' is object with keys: ${Object.keys(dataField as object).join(", ")}`
        } else {
          hint = `'data' is ${dataField === null ? "null" : typeof dataField}`
        }
      }
      console.warn(`[Shepherd] response keys: ${keys.join(", ")} | ${hint}`)
      console.warn(`[Shepherd] Hit GET /api/shepherd/debug in the browser for the full response shape`)
    }
    errors.push(
      `No vehicles array found in response (${hint || "unknown shape"}). Check /api/shepherd/debug for the raw response.`,
    )
  }

  const ts = Date.now()

  for (const raw of list) {
    const mapped = mapShepherdVehicle(raw)
    if (!mapped) {
      skipped += 1
      continue
    }

    try {
      await upsertDevice(
        mapped.deviceId,
        mapped.name,
        mapped.type,
        mapped.location,
        mapped.metrics,
      )
      await updateDeviceStatus(mapped.deviceId, mapped.status)

      emitTelemetryUpdate({
        deviceId: mapped.deviceId,
        timestamp: ts,
        location: mapped.location,
        metrics: mapped.metrics,
      })
      synced += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${mapped.deviceId}: ${msg}`)
    }
  }

  return {
    ok: errors.length === 0 || synced > 0,
    synced,
    skipped,
    errors,
    vehiclesPath: cfg.vehiclesPath,
  }
}
