import { isUsingFallback, query } from "./db";
import { getInMemoryStore } from "./db-fallback";

export interface TelemetryData {
  deviceId: string
  timestamp: number
  location: { lat: number; lng: number }
  metrics: {
    temperature: number
    speed: number
    fuel: number
    humidity?: number
  }
}

export async function insertTelemetry(data: TelemetryData): Promise<void> {
  if (isUsingFallback()) {
    getInMemoryStore().insertTelemetry(data)
    return
  }
  const { deviceId, timestamp, location, metrics } = data

  await query(
    `
    INSERT INTO telemetry (
      device_id,
      timestamp,
      location,
      latitude,
      longitude,
      speed,
      temperature,
      fuel,
      humidity
    ) VALUES (
      $1,
      to_timestamp($2 / 1000.0),
      ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8
    )
  `,
    [
      deviceId,
      timestamp,
      location.lat,
      location.lng,
      metrics.speed,
      metrics.temperature,
      metrics.fuel,
      metrics.humidity || null,
    ]
  )
}

export async function getTelemetryHistory(
  deviceId: string,
  limit: number = 100,
  startTime?: number,
  endTime?: number
): Promise<TelemetryData[]> {
  if (isUsingFallback()) {
    return getInMemoryStore().getTelemetryHistory(deviceId, limit)
  }
  let queryText = ` 
    SELECT 
      device_id,
      EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp,
      latitude as lat,
      longitude as lng,
      speed,
      temperature,
      fuel,
      humidity
    FROM telemetry
    WHERE device_id = $1
  `
  const params: unknown[] = [deviceId]

  if (startTime) {
    queryText += ` AND timestamp >= to_timestamp($${params.length + 1} / 1000.0)`
    params.push(startTime)
  }

  if (endTime) {
    queryText += ` AND timestamp <= to_timestamp($${params.length + 1} / 1000.0)`
    params.push(endTime)
  }

  queryText += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const result = await query<{
    device_id: string
    timestamp: number
    lat: number
    lng: number
    speed: number
    temperature: number
    fuel: number
    humidity: number | null
  }>(queryText, params)

  return result.rows.map((row) => ({
    deviceId: row.device_id,
    timestamp: Math.round(row.timestamp),
    location: {
      lat: row.lat,
      lng: row.lng,
    },
    metrics: {
      temperature: row.temperature,
      speed: row.speed,
      fuel: row.fuel,
      humidity: row.humidity || undefined,
    },
  }))
}

export async function getLatestTelemetryForAllDevices(): Promise<
  TelemetryData[]
> {
  const result = await query<{
    device_id: string
    timestamp: number
    lat: number
    lng: number
    speed: number
    temperature: number
    fuel: number
    humidity: number | null
  }>(`
    SELECT DISTINCT ON (device_id)
      device_id,
      EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp,
      latitude as lat,
      longitude as lng,
      speed,
      temperature,
      fuel,
      humidity
    FROM telemetry
    ORDER BY device_id, timestamp DESC
  `)

  return result.rows.map((row) => ({
    deviceId: row.device_id,
    timestamp: Math.round(row.timestamp),
    location: {
      lat: row.lat,
      lng: row.lng,
    },
    metrics: {
      temperature: row.temperature,
      speed: row.speed,
      fuel: row.fuel,
      humidity: row.humidity || undefined,
    },
  }))
}