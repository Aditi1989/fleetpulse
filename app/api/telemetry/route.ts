import { insertAlert } from "@/lib/db-alerts"
import { updateDeviceStatus } from "@/lib/db-devices"
import { insertTelemetry } from "@/lib/db-telemetry"
import { emitAlert, emitTelemetryUpdate } from "@/lib/socket-server"
import { NextResponse } from "next/server"
import { z } from "zod"

// Validation schema for telemetry data
const telemetrySchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  timestamp: z.number().positive("Timestamp must be positive"),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  metrics: z.object({
    temperature: z.number().min(-50).max(200),
    speed: z.number().min(0).max(200),
    fuel: z.number().min(0).max(100),
    humidity: z.number().min(0).max(100).optional(),
  }),
})

// Alert thresholds
const ALERT_THRESHOLDS = {
  speed: { high: 80, medium: 70 },         // km/h
  temperature: { high: 52, medium: 48 },   // °C — EV battery warning range
  fuel: { low: 15, critical: 5 },          // SOC %
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate telemetry data
    const validationResult = telemetrySchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid telemetry data", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const telemetryData = validationResult.data

    // Save telemetry to database
    await insertTelemetry(telemetryData)

    // Check for alerts and update device status
    const alerts = await checkAlerts(telemetryData)

    // Update device status based on metrics
    const status = getDeviceStatus(telemetryData.metrics)
    await updateDeviceStatus(telemetryData.deviceId, status)

    // Emit telemetry update via Socket.IO
    emitTelemetryUpdate(telemetryData)

    // Emit alerts via Socket.IO
    for (const alert of alerts) {
      emitAlert({
        id: alert.id.toString(),
        deviceId: alert.deviceId,
        type: alert.alertType,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.createdAt.getTime(),
      })
    }

    return NextResponse.json({ success: true, alerts: alerts.length })
  } catch (error) {
    console.error("Error processing telemetry:", error)
    return NextResponse.json(
      { error: "Failed to process telemetry" },
      { status: 500 }
    )
  }
}

// Check for alerts based on telemetry data
async function checkAlerts(data: typeof telemetrySchema._type) {
  const alerts = []

  // Speed alerts
  if (data.metrics.speed > ALERT_THRESHOLDS.speed.high) {
    const alert = await insertAlert(
      data.deviceId,
      "speed",
      "high",
      `Vehicle ${data.deviceId} exceeding speed limit: ${data.metrics.speed} km/h`
    )
    alerts.push(alert)
  } else if (data.metrics.speed > ALERT_THRESHOLDS.speed.medium) {
    const alert = await insertAlert(
      data.deviceId,
      "speed",
      "medium",
      `Vehicle ${data.deviceId} approaching speed limit: ${data.metrics.speed} km/h`
    )
    alerts.push(alert)
  }

  // Temperature alerts
  if (data.metrics.temperature > ALERT_THRESHOLDS.temperature.high) {
    const alert = await insertAlert(
      data.deviceId,
      "temperature",
      "high",
      `High battery temperature detected: ${data.metrics.temperature}°C`
    )
    alerts.push(alert)
  } else if (data.metrics.temperature > ALERT_THRESHOLDS.temperature.medium) {
    const alert = await insertAlert(
      data.deviceId,
      "temperature",
      "medium",
      `Elevated battery temperature: ${data.metrics.temperature}°C`
    )
    alerts.push(alert)
  }

  // Fuel alerts
  if (data.metrics.fuel < ALERT_THRESHOLDS.fuel.critical) {
    const alert = await insertAlert(
      data.deviceId,
      "fuel",
      "high",
      `Critical fuel level: ${data.metrics.fuel}%`
    )
    alerts.push(alert)
  } else if (data.metrics.fuel < ALERT_THRESHOLDS.fuel.low) {
    const alert = await insertAlert(
      data.deviceId,
      "fuel",
      "medium",
      `Low fuel warning: ${data.metrics.fuel}%`
    )
    alerts.push(alert)
  }

  return alerts
}

// Get device status based on metrics
function getDeviceStatus(metrics: typeof telemetrySchema._type.metrics): "online" | "offline" | "warning" {
  if (
    metrics.temperature > ALERT_THRESHOLDS.temperature.high ||
    metrics.speed > ALERT_THRESHOLDS.speed.high ||
    metrics.fuel < ALERT_THRESHOLDS.fuel.low
  ) {
    return "warning"
  }
  return "online"
}

// Get telemetry history for a device
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("deviceId")
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const startTime = searchParams.get("startTime")
      ? parseInt(searchParams.get("startTime")!, 10)
      : undefined
    const endTime = searchParams.get("endTime")
      ? parseInt(searchParams.get("endTime")!, 10)
      : undefined

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    const { getTelemetryHistory } = await import("@/lib/db-telemetry")
    const history = await getTelemetryHistory(deviceId, limit, startTime, endTime)

    return NextResponse.json({ history })
  } catch (error) {
    console.error("Error fetching telemetry history:", error)
    return NextResponse.json(
      { error: "Failed to fetch telemetry history" },
      { status: 500 }
    )
  }
}
