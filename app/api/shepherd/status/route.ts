import { NextResponse } from "next/server"
import { getShepherdConfig } from "@/lib/shepherd/config"
import { shepherdLogin, ShepherdAuthError } from "@/lib/shepherd/auth"

/**
 * GET /api/shepherd/status
 * Safe configuration summary (no secrets).
 * Optional: ?probe=1 attempts login to verify credentials (Bearer token path only).
 */
export async function GET(request: Request) {
  const cfg = getShepherdConfig()
  const { searchParams } = new URL(request.url)
  const probe = searchParams.get("probe") === "1"

  const base = {
    enabled: cfg.enabled,
    baseUrl: cfg.baseUrl,
    loginPath: cfg.loginPath,
    vehiclesPath: cfg.vehiclesPath,
    authMode: cfg.authMode,
    syncIntervalMs: cfg.syncIntervalMs,
    hasSyncSecret: Boolean(cfg.syncSecret),
    requestTimeoutMs: cfg.requestTimeoutMs,
  }

  if (!probe || !cfg.enabled) {
    return NextResponse.json(base)
  }

  if (cfg.authMode === "basic") {
    return NextResponse.json({
      ...base,
      probe: "skipped",
      message: "probe only runs login(); use authMode bearer or call POST /api/shepherd/sync to test full flow",
    })
  }

  try {
    await shepherdLogin()
    return NextResponse.json({ ...base, probe: "ok", login: "ok" })
  } catch (e) {
    const msg = e instanceof ShepherdAuthError ? e.message : e instanceof Error ? e.message : String(e)
    return NextResponse.json({
      ...base,
      probe: "failed",
      login: "error",
      error: msg,
    })
  }
}
