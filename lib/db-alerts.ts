import { isUsingFallback, query } from "./db"
import { getInMemoryStore } from "./db-fallback"

export interface Alert {
  id: number
  deviceId: string
  alertType: "speed" | "temperature" | "fuel" | "geofence"
  severity: "low" | "medium" | "high"
  message: string
  isActive: boolean
  createdAt: Date
  resolvedAt: Date | null
}
export async function insertAlert(
  deviceId: string,
  alertType: "speed" | "temperature" | "fuel" | "geofence",
  severity: "low" | "medium" | "high",
  message: string
): Promise<Alert> {
  if (isUsingFallback()) {
    const alertId = Date.now()
    const alert: Alert = {
      id: alertId,
      deviceId,
      alertType,
      severity,
      message,
      isActive: true,
      createdAt: new Date(),
      resolvedAt: null,
    }
    getInMemoryStore().insertAlert({
      id: alert.id.toString(),
      deviceId: alert.deviceId,
      type: alert.alertType,
      message: alert.message,
      severity: alert.severity,
      timestamp: alert.createdAt.getTime(),
    })
    return alert
  }
  const result = await query<{
    id: number
    device_id: string
    alert_type: string
    severity: string
    message: string
    is_active: boolean
    created_at: Date
    resolved_at: Date | null
  }>(
    `
    INSERT INTO alerts (device_id, alert_type, severity, message, is_active)
    VALUES ($1, $2, $3, $4, true)
    RETURNING id, device_id, alert_type, severity, message, is_active, created_at, resolved_at
  `,
    [deviceId, alertType, severity, message]
  )

  const row = result.rows[0]
  return {
    id: row.id,
    deviceId: row.device_id,
    alertType: row.alert_type as Alert["alertType"],
    severity: row.severity as Alert["severity"],
    message: row.message,
    isActive: row.is_active,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

export async function getAlerts(
  deviceId?: string,
  isActive?: boolean,
  limit: number = 100
): Promise<Alert[]> {
  if (isUsingFallback()) {
    const store = getInMemoryStore()
    let alerts = store.getAlerts(deviceId, limit)

    if (isActive === false) {
      alerts = []
    }

    return alerts.map((a) => ({
      id: parseInt(a.id, 10) || 0,
      deviceId: a.deviceId,
      alertType: a.type,
      severity: a.severity,
      message: a.message,
      isActive: true,
      createdAt: new Date(a.timestamp),
      resolvedAt: null,
    }))
  }
  let queryText = `
    SELECT 
      id,
      device_id,
      alert_type,
      severity,
      message,
      is_active,
      created_at,
      resolved_at
    FROM alerts
    WHERE 1=1
  `
  const params: unknown[] = []

  if (deviceId) {
    queryText += ` AND device_id = $${params.length + 1}`
    params.push(deviceId)
  }

  if (isActive !== undefined) {
    queryText += ` AND is_active = $${params.length + 1}`
    params.push(isActive)
  }

  queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const result = await query<{
    id: number
    device_id: string
    alert_type: string
    severity: string
    message: string
    is_active: boolean
    created_at: Date
    resolved_at: Date | null
  }>(queryText, params)

  return result.rows.map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    alertType: row.alert_type as Alert["alertType"],
    severity: row.severity as Alert["severity"],
    message: row.message,
    isActive: row.is_active,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }))
}

// Resolve an alert
export async function resolveAlert(alertId: number): Promise<void> {
  if (isUsingFallback()) {
    console.log(`Alert ${alertId} resolved (fallback mode)`)
    return
  }
  await query(
    `
    UPDATE alerts
    SET is_active = false, resolved_at = NOW()
    WHERE id = $1
  `,
    [alertId]
  )
}