import { getShepherdConfig } from "@/lib/shepherd/config"
import { syncShepherdFleet } from "@/lib/shepherd/sync"
import { NextResponse } from "next/server"

function isAuthorized(request: Request, body: { syncSecret?: string }): boolean {
  const cfg = getShepherdConfig()
  if (!cfg.syncSecret) {
    return true
  }
  const auth = request.headers.get("authorization")
  if (auth === `Bearer ${cfg.syncSecret}`) {
    return true
  }
  if (body?.syncSecret === cfg.syncSecret) {
    return true
  }
  return false
}

/**
 * POST /api/shepherd/sync
 * Pulls vehicles from Shepherd and upserts into FleetPulse (DB or in-memory) + Socket.IO.
 * When SHEPHERD_SYNC_SECRET is set, send Authorization: Bearer <secret> or JSON { "syncSecret": "..." }.
 */
export async function POST(request: Request) {
  const cfg = getShepherdConfig()
  let body: { syncSecret?: string } = {}
  try {
    const text = await request.text()
    if (text) {
      body = JSON.parse(text) as { syncSecret?: string }
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isAuthorized(request, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!cfg.enabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "Shepherd not configured",
        hint: "Set SHEPHERD_BASE_URL and SHEPHERD_BASIC_USER / SHEPHERD_BASIC_PASSWORD (or SHEPHERD_BASIC_AUTH)",
      },
      { status: 503 },
    )
  }

  const result = await syncShepherdFleet()
  return NextResponse.json(result)
}
