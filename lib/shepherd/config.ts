/**
 * Euler Shepherd API — configuration from environment (server-only).
 *
 * Required when using Shepherd: SHEPHERD_BASE_URL + credentials.
 * Credentials: SHEPHERD_BASIC_USER + SHEPHERD_BASIC_PASSWORD, or SHEPHERD_BASIC_AUTH (base64 of user:pass).
 */

export interface ShepherdConfig {
  enabled: boolean
  baseUrl: string
  loginPath: string
  vehiclesPath: string
  /** HTTP method to use for vehiclesPath — defaults to GET, set "POST" for filter-based endpoints */
  vehiclesMethod: "GET" | "POST"
  /** Base64 "user:pass" for Authorization: Basic */
  basicAuth: string
  /** After login, use Bearer token (default) or keep Basic for all requests */
  authMode: "bearer" | "basic"
  /**
   * String prepended to the JWT in the Authorization header.
   * Euler Shepherd sends the raw JWT with NO prefix (default "").
   * Set SHEPHERD_TOKEN_PREFIX="Bearer " for standard RFC 6750 APIs.
   */
  tokenPrefix: string
  /** Optional secret to protect POST /api/shepherd/sync from the open internet */
  syncSecret: string | null
  /** Milliseconds between automatic syncs when SHEPHERD_SYNC_INTERVAL_MS is set (server.ts) */
  syncIntervalMs: number | null
  requestTimeoutMs: number
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

function buildBasicAuth(): string | null {
  const raw = process.env.SHEPHERD_BASIC_AUTH?.trim()
  if (raw) {
    return raw
  }
  const user = process.env.SHEPHERD_BASIC_USER?.trim()
  const pass = process.env.SHEPHERD_BASIC_PASSWORD ?? ""
  if (user) {
    return Buffer.from(`${user}:${pass}`, "utf8").toString("base64")
  }
  return null
}

export function getShepherdConfig(): ShepherdConfig {
  const baseUrl = trimTrailingSlash(process.env.SHEPHERD_BASE_URL?.trim() || "")
  const basicAuth = buildBasicAuth()
  const enabled = Boolean(baseUrl && basicAuth)

  const syncIntervalRaw = process.env.SHEPHERD_SYNC_INTERVAL_MS?.trim()
  let syncIntervalMs: number | null = null
  if (syncIntervalRaw) {
    const n = parseInt(syncIntervalRaw, 10)
    if (!Number.isNaN(n) && n >= 5000) {
      syncIntervalMs = n
    }
  }

  const authMode =
    process.env.SHEPHERD_AUTH_MODE?.toLowerCase() === "basic" ? "basic" : "bearer"

  // Euler Shepherd sends the raw JWT with no prefix. Override with SHEPHERD_TOKEN_PREFIX="Bearer "
  // if you switch to a standard RFC-6750 API.
  const tokenPrefix = process.env.SHEPHERD_TOKEN_PREFIX ?? ""

  const vehiclesMethodRaw = process.env.SHEPHERD_VEHICLES_METHOD?.trim().toUpperCase()
  const vehiclesMethod: "GET" | "POST" =
    vehiclesMethodRaw === "POST" ? "POST" : "GET"

  return {
    enabled,
    baseUrl: baseUrl || "https://shepherd.eulermotors.com",
    loginPath: process.env.SHEPHERD_LOGIN_PATH?.trim() || "/api/v3/user-login",
    vehiclesPath: process.env.SHEPHERD_VEHICLES_PATH?.trim() || "/api/v1/vehicle-groups/list",
    vehiclesMethod,
    basicAuth: basicAuth || "",
    authMode,
    tokenPrefix,
    syncSecret: process.env.SHEPHERD_SYNC_SECRET?.trim() || null,
    syncIntervalMs,
    requestTimeoutMs: Math.min(
      120_000,
      Math.max(5000, parseInt(process.env.SHEPHERD_REQUEST_TIMEOUT_MS || "30000", 10) || 30000),
    ),
  }
}
