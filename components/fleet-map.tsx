"use client"

import type { Device } from "@/types/fleet"
import { useEffect, useRef } from "react"

interface FleetMapProps {
  devices: Device[]
}

// Default centre — New Delhi. Map auto-fits to actual vehicle positions once they load.
const DEFAULT_CENTER: [number, number] = [28.6139, 77.209]
const DEFAULT_ZOOM = 11

// Euler HiLoad EV max range in km
const HILOAD_MAX_RANGE_KM = 151

function rangeKm(soc: number) {
  return Math.round((soc / 100) * HILOAD_MAX_RANGE_KM)
}

function statusColor(status: Device["status"]) {
  if (status === "online")  return "#10b981"
  if (status === "warning") return "#f59e0b"
  if (status === "offline") return "#ef4444"
  return "#6b7280"
}

function pinSvg(color: string) {
  // Returns a data-URI-safe SVG teardrop pin
  return (
    `data:image/svg+xml,` +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">` +
      `<path d="M14 0C6.27 0 0 6.27 0 14c0 9.75 14 22 14 22S28 23.75 28 14C28 6.27 21.73 0 14 0z"` +
      ` fill="${color}" stroke="white" stroke-width="2"/>` +
      `<circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>` +
      `</svg>`,
    )
  )
}

export default function FleetMap({ devices }: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map())
  const fittedRef  = useRef(false) // only auto-fit once

  // ── Initialise map (runs once on mount, client-side only) ──────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    let alive = true

    import("leaflet").then((mod) => {
      if (!alive || !containerRef.current || mapRef.current) return
      const L = mod.default ?? mod

      // Fix Leaflet default icon path issue in webpack/Next.js bundles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(containerRef.current!, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
    })

    return () => {
      alive = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
        fittedRef.current = false
      }
    }
  }, [])

  // ── Sync markers whenever device list changes ──────────────────────────────
  useEffect(() => {
    if (!devices.length) return

    // Poll until Leaflet has initialised (map mounts asynchronously)
    const trySync = () => {
      const map = mapRef.current
      if (!map) {
        setTimeout(trySync, 150)
        return
      }

      import("leaflet").then((mod) => {
        const L = mod.default ?? mod
        const currentIds = new Set(devices.map((d) => d.id))

        // Remove stale markers
        markersRef.current.forEach((marker, id) => {
          if (!currentIds.has(id)) {
            marker.remove()
            markersRef.current.delete(id)
          }
        })

        devices.forEach((device) => {
          const { lat, lng } = device.location
          if (!lat || !lng) return

          const color = statusColor(device.status)
          const soc   = device.metrics.fuel
          const range = rangeKm(soc)

          const icon = L.icon({
            iconUrl:    pinSvg(color),
            iconSize:   [28, 36],
            iconAnchor: [14, 36],
            popupAnchor:[0, -38],
          })

          const popupHtml = `
            <div style="font-family:system-ui,sans-serif;min-width:200px;font-size:13px">
              <div style="font-weight:700;font-size:14px;margin-bottom:6px;
                          border-bottom:1px solid #e5e7eb;padding-bottom:6px">
                ${device.name}
              </div>
              <div style="display:grid;grid-template-columns:1fr auto;gap:3px 12px;
                          color:#374151;line-height:1.6">
                <span style="color:#6b7280">Registration</span>
                <span style="font-weight:600">${device.id}</span>

                <span style="color:#6b7280">Status</span>
                <span style="font-weight:600;color:${color}">${device.status.toUpperCase()}</span>

                <span style="color:#6b7280">Speed</span>
                <span>${device.metrics.speed} km/h</span>

                <span style="color:#6b7280">Battery (SOC)</span>
                <span style="font-weight:600;color:${soc < 20 ? "#ef4444" : "#10b981"}">${soc}%</span>

                <span style="color:#6b7280">Est. Range</span>
                <span style="color:${soc < 20 ? "#ef4444" : "#059669"}">~${range} km</span>

                <span style="color:#6b7280">Battery Temp</span>
                <span style="color:${device.metrics.temperature > 50 ? "#f59e0b" : "#374151"}">
                  ${device.metrics.temperature}°C
                </span>

                <span style="color:#6b7280">GPS</span>
                <span style="font-size:11px">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>

                <span style="color:#6b7280">Updated</span>
                <span style="font-size:11px">${new Date(device.lastUpdate).toLocaleTimeString()}</span>
              </div>
            </div>`

          const existing = markersRef.current.get(device.id)
          if (existing) {
            existing.setLatLng([lat, lng])
            existing.setIcon(icon)
            existing.getPopup()?.setContent(popupHtml)
          } else {
            const marker = L.marker([lat, lng], { icon })
              .bindPopup(popupHtml, { maxWidth: 240 })
              .addTo(map)
            markersRef.current.set(device.id, marker)
          }
        })

        // Auto-fit bounds to all vehicles on first load
        if (!fittedRef.current) {
          const valid = devices.filter((d) => d.location.lat && d.location.lng)
          if (valid.length > 0) {
            const latlngs = valid.map((d) => [d.location.lat, d.location.lng] as [number, number])
            try {
              if (valid.length === 1) {
                map.setView(latlngs[0], 13)
              } else {
                map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 14 })
              }
              fittedRef.current = true
            } catch {
              // fallback to Delhi default
            }
          }
        }
      })
    }

    trySync()
  }, [devices])

  const onlineCount  = devices.filter((d) => d.status === "online").length
  const warningCount = devices.filter((d) => d.status === "warning").length
  const offlineCount = devices.filter((d) => d.status === "offline").length

  return (
    <div className="relative h-full w-full">
      {/* Map container — Leaflet attaches to this div */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Status legend */}
      <div className="absolute bottom-6 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-md
                      border px-3 py-2.5 text-xs z-[1000] min-w-[130px]">
        <p className="font-semibold text-gray-700 mb-1.5">Fleet Status</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Online
            </span>
            <span className="font-medium">{onlineCount}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Warning
            </span>
            <span className="font-medium">{warningCount}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Offline
            </span>
            <span className="font-medium">{offlineCount}</span>
          </div>
        </div>
      </div>

      {/* Empty state overlay */}
      {devices.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-[500]">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">🚛</div>
            <div className="font-medium">No vehicles loaded</div>
            <div className="text-xs mt-1 text-gray-400">Start the simulation to see live positions</div>
          </div>
        </div>
      )}
    </div>
  )
}
