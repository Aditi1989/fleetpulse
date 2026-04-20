import { isUsingFallback, query } from "./db"
import { getInMemoryStore } from "./db-fallback"
import { insertTelemetry } from "./db-telemetry"

export interface Device {
  id: string
  name: string
  type: string
  status: "online" | "offline" | "warning"
  location: { lat: number; lng: number }
  metrics: {
    temperature: number
    speed: number
    fuel: number
    humidity?: number
  }
  lastUpdate: string
}

// Get all devices with their latest telemetry
export async function getAllDevices(): Promise<Device[]> {
  if (isUsingFallback()) {
    return getInMemoryStore().getAllDevices()
  }

  const result = await query<{
    id: string
    name: string
    type: string
    status: string
    lat: number
    lng: number
    temperature: number
    speed: number
    fuel: number
    humidity: number | null
    last_update: Date
  }>(`
    SELECT 
      d.id,
      d.name,
      d.type,
      d.status,
      t.latitude as lat,
      t.longitude as lng,
      t.temperature,
      t.speed,
      t.fuel,
      t.humidity,
      t.timestamp as last_update
    FROM devices d
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, temperature, speed, fuel, humidity, timestamp
      FROM telemetry
      WHERE device_id = d.id
      ORDER BY timestamp DESC
      LIMIT 1
    ) t ON true
    ORDER BY d.created_at DESC
  `)

  if (isUsingFallback()) {
    return getInMemoryStore().getAllDevices()
  }

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status as Device["status"],
    location: {
      lat: row.lat || 37.7749,
      lng: row.lng || -122.4194,
    },
    metrics: {
      temperature: row.temperature || 70,
      speed: row.speed || 0,
      fuel: row.fuel || 100,
      humidity: row.humidity || undefined,
    },
    lastUpdate: row.last_update?.toISOString() || new Date().toISOString(),
  }))
}

// Get a single device by ID
export async function getDeviceById(deviceId: string): Promise<Device | null> {
  if (isUsingFallback()) {
    return getInMemoryStore().getDeviceById(deviceId)
  }

  const result = await query<{
    id: string
    name: string
    type: string
    status: string
    lat: number
    lng: number
    temperature: number
    speed: number
    fuel: number
    humidity: number | null
    last_update: Date
  }>(
    `
    SELECT 
      d.id,
      d.name,
      d.type,
      d.status,
      t.latitude as lat,
      t.longitude as lng,
      t.temperature,
      t.speed,
      t.fuel,
      t.humidity,
      t.timestamp as last_update
    FROM devices d
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, temperature, speed, fuel, humidity, timestamp
      FROM telemetry
      WHERE device_id = d.id
      ORDER BY timestamp DESC
      LIMIT 1
    ) t ON true
    WHERE d.id = $1
  `,
    [deviceId]
  )

  if (isUsingFallback()) {
    return getInMemoryStore().getDeviceById(deviceId)
  }

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status as Device["status"],
    location: {
      lat: row.lat || 37.7749,
      lng: row.lng || -122.4194,
    },
    metrics: {
      temperature: row.temperature || 70,
      speed: row.speed || 0,
      fuel: row.fuel || 100,
      humidity: row.humidity || undefined,
    },
    lastUpdate: row.last_update?.toISOString() || new Date().toISOString(),
  }
}

// Create or update a device
export async function upsertDevice(
  deviceId: string,
  name: string,
  type: string,
  location?: { lat: number; lng: number },
  metrics?: { temperature: number; speed: number; fuel: number; humidity?: number }
): Promise<Device> {
  if (isUsingFallback()) {
    const store = getInMemoryStore()
    const device: Device = {
      id: deviceId,
      name,
      type,
      status: "online",
      location: location || { lat: 37.7749, lng: -122.4194 },
      metrics: metrics || { temperature: 70, speed: 0, fuel: 100 },
      lastUpdate: new Date().toISOString(),
    }
    return store.upsertDevice(device)
  }
  await query(
    `
    INSERT INTO devices (id, name, type, status, updated_at)
    VALUES ($1, $2, $3, 'online', NOW())
    ON CONFLICT (id) 
    DO UPDATE SET 
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      status = 'online',
      updated_at = NOW()
  `,
    [deviceId, name, type]
  )

  // If location and metrics provided, also insert telemetry
  if (location && metrics) {
    await insertTelemetry({
      deviceId,
      timestamp: Date.now(),
      location,
      metrics,
    })
  }

  const device = await getDeviceById(deviceId)
  if (!device) {
    throw new Error("Failed to retrieve created device")
  }

  return device
}

// Update device status
export async function updateDeviceStatus(
  deviceId: string,
  status: "online" | "offline" | "warning"
): Promise<void> {
  if (isUsingFallback()) {
    getInMemoryStore().updateDeviceStatus(deviceId, status)
    return
  }
  await query(
    `
    UPDATE devices 
    SET status = $1, updated_at = NOW()
    WHERE id = $2
  `,
    [status, deviceId]
  )
}

