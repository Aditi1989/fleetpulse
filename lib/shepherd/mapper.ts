import type { Device } from "@/lib/db-devices"

export type MappedShepherdVehicle = {
  deviceId: string
  name: string
  type: string
  location: { lat: number; lng: number }
  metrics: {
    temperature: number
    speed: number
    fuel: number
    humidity?: number
  }
  status: Device["status"]
}

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.length > 0) return v
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return null
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

/**
 * Flatten a vehicle-groups response into individual vehicle objects.
 * Euler's /api/v1/vehicle-groups/list returns groups with nested vehicles arrays.
 * Each vehicle in a group is merged with group metadata (group name, group id).
 */
function flattenVehicleGroups(groups: unknown[]): unknown[] {
  const vehicles: unknown[] = []
  for (const group of groups) {
    if (!group || typeof group !== "object") continue
    const g = group as Record<string, unknown>
    const groupId = g.id ?? g.groupId ?? g.group_id
    const groupName = g.name ?? g.groupName ?? g.group_name

    // Try common keys that hold the vehicles list inside a group
    const nested =
      (Array.isArray(g.vehicles) ? g.vehicles : null) ??
      (Array.isArray(g.vehicleList) ? g.vehicleList : null) ??
      (Array.isArray(g.vehicle_list) ? g.vehicle_list : null) ??
      (Array.isArray(g.items) ? g.items : null) ??
      (Array.isArray(g.data) ? g.data : null)

    if (nested && nested.length > 0) {
      // Attach group context onto each vehicle for name/type enrichment
      for (const v of nested) {
        vehicles.push({
          _groupId: groupId,
          _groupName: groupName,
          ...(v && typeof v === "object" ? (v as Record<string, unknown>) : { raw: v }),
        })
      }
    } else {
      // The group itself might be the vehicle (no nesting)
      vehicles.push(g)
    }
  }
  return vehicles
}

/** Try to find an array of vehicle-like objects in a typical API envelope */
export function extractVehiclesArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    // Could be a flat vehicle array OR a vehicle-groups array — try to detect
    if (payload.length === 0) return []
    const first = payload[0]
    if (first && typeof first === "object") {
      const f = first as Record<string, unknown>
      const hasNestedVehicles =
        Array.isArray(f.vehicles) ||
        Array.isArray(f.vehicleList) ||
        Array.isArray(f.vehicle_list) ||
        Array.isArray(f.items)
      if (hasNestedVehicles) {
        return flattenVehicleGroups(payload)
      }
    }
    return payload
  }

  if (!payload || typeof payload !== "object") return []

  const o = payload as Record<string, unknown>
  const tryKeys = ["data", "vehicles", "result", "items", "fleet", "records", "content", "groups", "vehicleGroups", "vehicle_groups"]

  for (const key of tryKeys) {
    const v = o[key]
    if (Array.isArray(v)) {
      if (v.length === 0) return v
      const first = v[0]
      if (first && typeof first === "object") {
        const f = first as Record<string, unknown>
        const hasNestedVehicles =
          Array.isArray(f.vehicles) ||
          Array.isArray(f.vehicleList) ||
          Array.isArray(f.vehicle_list) ||
          Array.isArray(f.items)
        if (hasNestedVehicles) {
          return flattenVehicleGroups(v)
        }
      }
      return v
    }
    if (v && typeof v === "object") {
      const inner = v as Record<string, unknown>
      for (const k2 of ["vehicles", "data", "list", "rows"]) {
        const a = inner[k2]
        if (Array.isArray(a)) return a
      }
    }
  }

  return []
}

/** Derive FleetPulse status from metrics (aligned with app/api/telemetry thresholds) */
export function deriveStatusFromMetrics(metrics: MappedShepherdVehicle["metrics"]): Device["status"] {
  if (metrics.temperature > 85 || metrics.speed > 80 || metrics.fuel < 15) {
    return "warning"
  }
  return "online"
}

function readLatLng(obj: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat =
    firstNumber(obj, ["latitude", "lat", "gpsLatitude", "gps_lat"]) ??
    (obj.location && typeof obj.location === "object"
      ? firstNumber(obj.location as Record<string, unknown>, ["latitude", "lat"])
      : null) ??
    (obj.position && typeof obj.position === "object"
      ? firstNumber(obj.position as Record<string, unknown>, ["latitude", "lat"])
      : null)

  const lng =
    firstNumber(obj, ["longitude", "lng", "gpsLongitude", "gps_lng", "lon"]) ??
    (obj.location && typeof obj.location === "object"
      ? firstNumber(obj.location as Record<string, unknown>, ["longitude", "lng", "lon"])
      : null) ??
    (obj.position && typeof obj.position === "object"
      ? firstNumber(obj.position as Record<string, unknown>, ["longitude", "lng", "lon"])
      : null)

  if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return { lat, lng }
  }

  // GeoJSON Point: coordinates: [lng, lat]
  const coords = obj.coordinates
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng2 = num(coords[0], NaN)
    const lat2 = num(coords[1], NaN)
    if (Number.isFinite(lng2) && Number.isFinite(lat2)) {
      return { lat: lat2, lng: lng2 }
    }
  }

  const geometry = obj.geometry
  if (geometry && typeof geometry === "object") {
    const g = geometry as Record<string, unknown>
    if (g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      const lng2 = num(g.coordinates[0], NaN)
      const lat2 = num(g.coordinates[1], NaN)
      if (Number.isFinite(lng2) && Number.isFinite(lat2)) {
        return { lat: lat2, lng: lng2 }
      }
    }
  }

  return null
}

/**
 * Map one Shepherd / generic vehicle JSON object into FleetPulse shape.
 * Tweak with env SHEPHERD_DEFAULT_LAT / SHEPHERD_DEFAULT_LNG if API omits GPS temporarily.
 */
export function mapShepherdVehicle(raw: unknown): MappedShepherdVehicle | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>

  const deviceId =
    firstString(o, [
      "vehicleId",
      "vehicle_id",
      "id",
      "deviceId",
      "device_id",
      "vin",
      "registrationNumber",
      "registration_number",
      "chassisNumber",
    ]) ?? null

  if (!deviceId) return null

  const name =
    firstString(o, ["name", "vehicleName", "vehicle_name", "label", "registrationNumber"]) ??
    `Vehicle ${deviceId}`

  const type = firstString(o, ["type", "vehicleType", "vehicle_type", "model", "category"]) ?? "vehicle"

  const defaultLat = num(process.env.SHEPHERD_DEFAULT_LAT, 28.6139)
  const defaultLng = num(process.env.SHEPHERD_DEFAULT_LNG, 77.209)

  const ll = readLatLng(o) ?? { lat: defaultLat, lng: defaultLng }

  const speed = firstNumber(o, ["speed", "vehicleSpeed", "speedKmph", "speed_kmph", "velocity"]) ?? 0
  const temperature =
    firstNumber(o, [
      "temperature",
      "engineTemperature",
      "motorTemperature",
      "batteryTemperature",
      "temp",
    ]) ?? 70

  const fuel =
    firstNumber(o, [
      "fuel",
      "fuelLevel",
      "fuel_level",
      "soc",
      "batterySoc",
      "battery_soc",
      "batteryPercentage",
      "battery_percentage",
      "chargePercent",
    ]) ?? 100

  const humidity = firstNumber(o, ["humidity", "relativeHumidity"]) ?? undefined

  const metrics = {
    temperature: Math.round(num(temperature, 70)),
    speed: Math.max(0, Math.min(200, Math.round(num(speed, 0)))),
    fuel: Math.max(0, Math.min(100, Math.round(num(fuel, 100)))),
    ...(humidity !== null ? { humidity: Math.round(num(humidity, 50)) } : {}),
  }

  const online = firstString(o, ["status", "connectivity", "connectionStatus", "isOnline"])
  let status: Device["status"] = deriveStatusFromMetrics(metrics)
  if (online && /offline|disconnected|inactive/i.test(online)) {
    status = "offline"
  }

  return {
    deviceId: String(deviceId),
    name,
    type,
    location: ll,
    metrics,
    status,
  }
}
