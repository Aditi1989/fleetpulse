import { existsSync, readFileSync } from "fs"
import { createServer } from "http"
import { join } from "path"
import next from "next"
import { parse } from "url"

/** Load `.env.local` into `process.env` before Shepherd config (custom server). */
function loadEnvLocal(): void {
  const p = join(process.cwd(), ".env.local")
  if (!existsSync(p)) return
  const content = readFileSync(p, "utf8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key) {
      process.env[key] = val
    }
  }
}

loadEnvLocal()
import { getShepherdConfig } from "./lib/shepherd/config"
import { syncShepherdFleet } from "./lib/shepherd/sync"
import { initSocketIO } from "./lib/socket-server"

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = parseInt(process.env.PORT || "3001", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error("Error occurred handling", req.url, err)
      res.statusCode = 500
      res.end("internal server error")
    }
  })

  // Initialize Socket.IO
  initSocketIO(httpServer)

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)

    const shepherd = getShepherdConfig()
    if (shepherd.enabled) {
      syncShepherdFleet().catch((err) => console.error("[Shepherd] boot sync failed:", err))
      if (shepherd.syncIntervalMs) {
        setInterval(() => {
          syncShepherdFleet().catch((e) => console.error("[Shepherd sync]", e))
        }, shepherd.syncIntervalMs)
        console.log(`> Shepherd auto-sync every ${shepherd.syncIntervalMs}ms (${shepherd.vehiclesPath})`)
      }
    }
  })
})

