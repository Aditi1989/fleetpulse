import { getAlerts, resolveAlert } from "@/lib/db-alerts"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("deviceId")
    const isActive = searchParams.get("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined
    const limit = parseInt(searchParams.get("limit") || "100", 10)

    const alerts = await getAlerts(deviceId || undefined, isActive, limit)

    // Transform alerts to match frontend format
    const transformedAlerts = alerts.map((alert) => ({
      id: alert.id.toString(),
      deviceId: alert.deviceId,
      type: alert.alertType,
      message: alert.message,
      severity: alert.severity,
      timestamp: alert.createdAt.getTime(),
      isActive: alert.isActive,
      resolvedAt: alert.resolvedAt?.getTime() || null,
    }))

    return NextResponse.json({ alerts: transformedAlerts })
  } catch (error) {
    console.error("Error fetching alerts:", error)
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, alertId } = body

    if (action === "resolve" && alertId) {
      await resolveAlert(parseInt(alertId, 10))
      return NextResponse.json({ success: true, message: "Alert resolved" })
    }

    return NextResponse.json(
      { error: "Invalid action or missing alertId" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error resolving alert:", error)
    return NextResponse.json(
      { error: "Failed to resolve alert" },
      { status: 500 }
    )
  }
}

