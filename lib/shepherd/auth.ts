import { getShepherdConfig } from "./config"

export class ShepherdAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message)
    this.name = "ShepherdAuthError"
  }
}

type TokenCache = {
  token: string
  /** Epoch ms when token should be considered expired */
  expiresAtMs: number
}

let cache: TokenCache | null = null

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined
    if (typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/**
 * Extract bearer/session token from login JSON. Override with SHEPHERD_TOKEN_JSON_PATH (dot path).
 */
export function extractTokenFromLoginBody(body: unknown): string | null {
  const customPath = process.env.SHEPHERD_TOKEN_JSON_PATH?.trim()
  if (customPath) {
    const v = getByPath(body, customPath)
    if (typeof v === "string" && v.length > 0) return v
  }

  if (!body || typeof body !== "object") return null
  const r = body as Record<string, unknown>

  const direct = r.access_token ?? r.accessToken ?? r.token ?? r.authToken ?? r.jwt
  if (typeof direct === "string" && direct.length > 0) return direct

  const nested = r.data
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>
    const t = d.access_token ?? d.accessToken ?? d.token ?? d.authToken
    if (typeof t === "string" && t.length > 0) return t
  }

  const result = r.result
  if (result && typeof result === "object") {
    const d = result as Record<string, unknown>
    const t = d.access_token ?? d.accessToken ?? d.token
    if (typeof t === "string" && t.length > 0) return t
  }

  return null
}

function extractExpiresInSeconds(body: unknown): number | null {
  if (!body || typeof body !== "object") return null
  const r = body as Record<string, unknown>
  const exp =
    r.expires_in ?? r.expiresIn ?? (r.data as Record<string, unknown> | undefined)?.expires_in
  if (typeof exp === "number" && Number.isFinite(exp) && exp > 0) return exp
  return null
}

export function clearShepherdTokenCache(): void {
  cache = null
}

export async function shepherdLogin(): Promise<{ token: string; raw: unknown }> {
  const cfg = getShepherdConfig()
  if (!cfg.enabled) {
    throw new ShepherdAuthError("Shepherd is not configured (SHEPHERD_BASE_URL + credentials)", 0)
  }

  const url = `${cfg.baseUrl}${cfg.loginPath}`
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), cfg.requestTimeoutMs)

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${cfg.basicAuth}`,
        client: "web",
      },
      body: "{}",
    })

    const text = await res.text()
    let json: unknown
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      throw new ShepherdAuthError(`Login response is not JSON (HTTP ${res.status})`, res.status, text)
    }

    if (!res.ok) {
      throw new ShepherdAuthError(
        `Shepherd login failed: HTTP ${res.status}`,
        res.status,
        text.slice(0, 500),
      )
    }

    const token = extractTokenFromLoginBody(json)
    if (!token) {
      throw new ShepherdAuthError(
        "Shepherd login succeeded but no token field was found. Set SHEPHERD_TOKEN_JSON_PATH to the dot-path of your token.",
        res.status,
        text.slice(0, 500),
      )
    }

    const expSec = extractExpiresInSeconds(json)
    const skewMs = 60_000
    const expiresAtMs = Date.now() + (expSec ?? 3600) * 1000 - skewMs

    cache = { token, expiresAtMs }

    return { token, raw: json }
  } finally {
    clearTimeout(t)
  }
}

export async function getShepherdAccessToken(): Promise<string> {
  const cfg = getShepherdConfig()
  if (cfg.authMode === "basic") {
    throw new Error("getShepherdAccessToken: authMode is 'basic'; use Authorization Basic on each request")
  }

  if (cache && Date.now() < cache.expiresAtMs) {
    return cache.token
  }

  const { token } = await shepherdLogin()
  return token
}
