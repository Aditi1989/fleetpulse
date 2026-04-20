import type { Device, TelemetryData } from "@/types/fleet"

/**
 * Sample Euler HiLoad EV fleet — Delhi NCR region.
 * Used as the in-memory fallback when no Shepherd API data is available.
 *
 * Coordinates are real Delhi / Gurugram / Noida locations.
 * Metrics use metric units: speed km/h, temperature °C, fuel = SOC %.
 */
const BASE_SAMPLE_DEVICES: Device[] = [
  {
    id: "DL-01-EA-1042",
    name: "HiLoad - Connaught Place",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.6315, lng: 77.2167 }, // Connaught Place, New Delhi
    metrics: { temperature: 34, speed: 28, fuel: 72, humidity: 58 },
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "DL-01-EA-1087",
    name: "HiLoad · Karol Bagh",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.6508, lng: 77.1904 }, // Karol Bagh, New Delhi
    metrics: { temperature: 38, speed: 41, fuel: 55, humidity: 52 },
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "DL-01-EA-1103",
    name: "HiLoad · Lajpat Nagar",
    type: "HiLoad EV",
    status: "warning",
    location: { lat: 28.5672, lng: 77.2430 }, // Lajpat Nagar, New Delhi
    metrics: { temperature: 47, speed: 19, fuel: 12, humidity: 44 }, // low SOC → warning
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "DL-01-EA-1155",
    name: "HiLoad · Dwarka Sector 12",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.5921, lng: 77.0460 }, // Dwarka, New Delhi
    metrics: { temperature: 31, speed: 55, fuel: 88, humidity: 61 },
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "DL-01-EA-1198",
    name: "HiLoad · Rohini Sector 9",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.7333, lng: 77.1167 }, // Rohini, New Delhi
    metrics: { temperature: 36, speed: 33, fuel: 64, humidity: 55 },
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "HR-26-EA-2211",
    name: "HiLoad · Cyber City Gurugram",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.4950, lng: 77.0897 }, // Cyber City, Gurugram
    metrics: { temperature: 33, speed: 47, fuel: 91, humidity: 49 },
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "HR-26-EA-2248",
    name: "HiLoad · Golf Course Rd",
    type: "HiLoad EV",
    status: "warning",
    location: { lat: 28.4642, lng: 77.1023 }, // Golf Course Road, Gurugram
    metrics: { temperature: 52, speed: 22, fuel: 29, humidity: 43 }, // high temp → warning
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "UP-16-EA-3301",
    name: "HiLoad · Noida Sector 18",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.5672, lng: 77.3238 }, // Sector 18, Noida
    metrics: { temperature: 35, speed: 39, fuel: 77, humidity: 57 },
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "UP-16-EA-3345",
    name: "HiLoad · Noida Sector 62",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.6271, lng: 77.3698 }, // Sector 62, Noida
    metrics: { temperature: 29, speed: 0, fuel: 100, humidity: 63 }, // charging / parked
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "DL-01-EA-1221",
    name: "HiLoad · Saket District Centre",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.5245, lng: 77.2066 }, // Saket, New Delhi
    metrics: { temperature: 37, speed: 51, fuel: 43, humidity: 50 },
    lastUpdate: new Date().toISOString(),
  },
  {
    id: "DL-01-EA-1267",
    name: "HiLoad · Okhla Industrial",
    type: "HiLoad EV",
    status: "offline",
    location: { lat: 28.5358, lng: 77.2735 }, // Okhla, New Delhi
    metrics: { temperature: 28, speed: 0, fuel: 18, humidity: 48 },
    lastUpdate: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18 min stale
  },
  {
    id: "HR-26-EA-2290",
    name: "HiLoad · Sohna Road Gurugram",
    type: "HiLoad EV",
    status: "online",
    location: { lat: 28.4230, lng: 77.0350 }, // Sohna Road, Gurugram
    metrics: { temperature: 32, speed: 60, fuel: 82, humidity: 53 },
    lastUpdate: new Date().toISOString(),
  },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Bounding box for Delhi NCR region — used by the simulation to keep vehicles in-region
const NCR_BOUNDS = {
  minLat: 28.40, maxLat: 28.75,
  minLng: 76.95, maxLng: 77.45,
}

export function getSampleDevices(): Device[] {
  return BASE_SAMPLE_DEVICES.map((device) => ({
    ...device,
    location: { ...device.location },
    metrics: { ...device.metrics },
    lastUpdate: new Date().toISOString(),
  }))
}

/**
 * Generate 20 historical telemetry snapshots per device spanning the last 10 minutes.
 * Used to pre-seed the analytics charts so they render immediately on page load
 * rather than waiting for live simulation ticks to accumulate.
 */
export function getSampleTelemetryHistory(): Record<string, TelemetryData[]> {
  const POINTS = 20
  const SPAN_MS = 10 * 60 * 1000 // 10 minutes
  const now = Date.now()
  const history: Record<string, TelemetryData[]> = {}

  for (const device of BASE_SAMPLE_DEVICES) {
    const points: TelemetryData[] = []
    let speed = device.metrics.speed
    let temperature = device.metrics.temperature
    let fuel = device.metrics.fuel
    let humidity = device.metrics.humidity ?? 52
    let lat = device.location.lat
    let lng = device.location.lng

    for (let i = 0; i < POINTS; i++) {
      // Walk forward in time so the oldest point is first
      const t = now - SPAN_MS + (i / (POINTS - 1)) * SPAN_MS

      // Gentle random walk for each metric
      speed = clamp(speed + (Math.random() - 0.5) * 6, 0, 65)
      const tempTarget = 30 + speed * 0.25
      temperature = clamp(temperature + (tempTarget - temperature) * 0.05 + (Math.random() - 0.5) * 1.2, 26, 58)
      fuel = clamp(fuel - speed * 0.006 - Math.random() * 0.2, 5, 100)
      humidity = clamp(humidity + (Math.random() - 0.5) * 1.5, 35, 75)
      lat = clamp(lat + (Math.random() - 0.5) * 0.0006, NCR_BOUNDS.minLat, NCR_BOUNDS.maxLat)
      lng = clamp(lng + (Math.random() - 0.5) * 0.0006, NCR_BOUNDS.minLng, NCR_BOUNDS.maxLng)

      points.push({
        deviceId: device.id,
        timestamp: Math.round(t),
        location: { lat, lng },
        metrics: {
          speed: Math.round(speed),
          temperature: Math.round(temperature),
          fuel: Math.round(fuel),
          humidity: Math.round(humidity),
        },
      })
    }

    history[device.id] = points
  }

  return history
}

export function simulateSampleDevice(device: Device): { device: Device; telemetry: TelemetryData } {
  // Skip movement for offline / parked vehicles
  const isParked = device.metrics.speed === 0 && device.status === "offline"
  const isCharging = device.metrics.speed === 0 && device.metrics.fuel >= 99

  const speedDelta = isParked || isCharging ? 0 : (Math.random() - 0.5) * 8
  const speed = clamp(device.metrics.speed + speedDelta, 0, 65) // max 65 km/h urban

  // Battery temperature: rises with speed and ambient heat, falls when parked
  const tempTarget = 30 + speed * 0.25
  const temperature = clamp(
    device.metrics.temperature + (tempTarget - device.metrics.temperature) * 0.05 + (Math.random() - 0.5) * 1.5,
    26,
    58,
  )

  // SOC drains proportional to speed; recharges if parked at depot
  const socDrain = isCharging ? -2 : speed * 0.008 + Math.random() * 0.3
  const fuel = clamp(device.metrics.fuel - socDrain, 5, 100)

  const humidity = clamp((device.metrics.humidity ?? 52) + (Math.random() - 0.5) * 2, 35, 75)

  // Small GPS drift — keep within NCR bounds
  const lat = clamp(
    device.location.lat + (Math.random() - 0.5) * 0.0008,
    NCR_BOUNDS.minLat,
    NCR_BOUNDS.maxLat,
  )
  const lng = clamp(
    device.location.lng + (Math.random() - 0.5) * 0.0008,
    NCR_BOUNDS.minLng,
    NCR_BOUNDS.maxLng,
  )

  const updatedDevice: Device = {
    ...device,
    status:
      device.status === "offline"
        ? "offline"
        : fuel < 15 || temperature > 55
          ? "warning"
          : "online",
    location: { lat, lng },
    metrics: {
      ...device.metrics,
      speed: Math.round(speed),
      temperature: Math.round(temperature),
      fuel: Math.round(fuel),
      humidity: Math.round(humidity),
    },
    lastUpdate: new Date().toISOString(),
  }

  const telemetry: TelemetryData = {
    deviceId: updatedDevice.id,
    timestamp: Date.now(),
    location: updatedDevice.location,
    metrics: updatedDevice.metrics,
  }

  return { device: updatedDevice, telemetry }
}
