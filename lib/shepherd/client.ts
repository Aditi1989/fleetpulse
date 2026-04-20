import { getShepherdConfig } from "./config"
import { clearShepherdTokenCache, getShepherdAccessToken, shepherdLogin, ShepherdAuthError } from "./auth"

export class ShepherdHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(message)
    this.name = "ShepherdHttpError"
  }
}

export interface ShepherdFetchOptions {
  method?: "GET" | "POST"
  headers?: Record<string, string>
  body?: unknown
  /** If true, do not attach Bearer after login (use Basic only) */
  basicOnly?: boolean
}

/**
 * Authenticated request to Shepherd. Uses Bearer token after login unless SHEPHERD_AUTH_MODE=basic.
 * On 401, clears token cache and retries login once (Bearer mode only).
 */
export async function shepherdRequest(
  pathOrUrl: string,
  options: ShepherdFetchOptions = {},
): Promise<Response> {
  const cfg = getShepherdConfig()
  if (!cfg.enabled) {
    throw new ShepherdHttpError("Shepherd is not configured", 0)
  }

  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${cfg.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`

  const run = async (isRetry: boolean): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutMs)

    const headers: Record<string, string> = {
      Accept: "application/json",
      client: "web",
      ...options.headers,
    }

    if (options.body !== undefined && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json"
    }

    if (cfg.authMode === "basic" || options.basicOnly) {
      headers.Authorization = `Basic ${cfg.basicAuth}`
    } else {
      const token = await getShepherdAccessToken()
      // Euler Shepherd expects the raw JWT with no "Bearer " prefix (tokenPrefix is "").
      // Set SHEPHERD_TOKEN_PREFIX="Bearer " for standard RFC-6750 APIs.
      headers.Authorization = `${cfg.tokenPrefix}${token}`
    }

    try {
      const res = await fetch(url, {
        method: options.method || "GET",
        signal: controller.signal,
        headers,
        body:
          options.body !== undefined
            ? typeof options.body === "string"
              ? options.body
              : JSON.stringify(options.body)
            : undefined,
      })

      if (res.status === 401 && cfg.authMode === "bearer" && !isRetry) {
        clearShepherdTokenCache()
        await shepherdLogin()
        return run(true)
      }

      return res
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    return await run(false)
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ShepherdHttpError(`Shepherd request timed out (${cfg.requestTimeoutMs}ms)`, 0)
    }
    if (e instanceof ShepherdAuthError) throw e
    throw e
  }
}

export async function shepherdRequestJson<T = unknown>(
  pathOrUrl: string,
  options: ShepherdFetchOptions = {},
): Promise<T> {
  const res = await shepherdRequest(pathOrUrl, options)
  const text = await res.text()

  if (!res.ok) {
    throw new ShepherdHttpError(
      `Shepherd HTTP ${res.status}: ${pathOrUrl}`,
      res.status,
      text.slice(0, 800),
    )
  }

  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ShepherdHttpError(`Shepherd response is not JSON (HTTP ${res.status})`, res.status, text.slice(0, 400))
  }
}
