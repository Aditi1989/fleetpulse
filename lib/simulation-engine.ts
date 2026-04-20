import { upsertDevice } from "./db-devices"
import { insertTelemetry } from "./db-telemetry"
import { emitTelemetryUpdate } from "./socket-server"

export interface SimulationDevice {
  id: string
  name: string
  type: string
  baseLocation: { lat: number; lng: number }
  route: "highway" | "downtown" | "residential" | "industrial" | "suburban"
  currentLocation: { lat: number; lng: number }
  currentMetrics: {
    temperature: number
    speed: number    // km/h
    fuel: number     // SOC %
    humidity: number
  }
  direction: { lat: number; lng: number }
  speedMultiplier: number
}

// Delhi NCR bounding box — vehicles stay within this region
const NCR = { minLat: 28.40, maxLat: 28.75, minLng: 76.95, maxLng: 77.45 }

export class SimulationEngine {
  private devices: Map<string, SimulationDevice> = new Map()
  private interval: NodeJS.Timeout | null = null
  private isRunning = false
  private updateInterval = 2000 // 2 seconds

  constructor() {
    this.initializeDevices()
  }

  private initializeDevices() {
    // Mirror the 12 HiLoad EV vehicles from sample-data.ts
    const fleetDevices = [
      {
        id: "DL-01-EA-1042",
        name: "HiLoad · Connaught Place",
        type: "HiLoad EV",
        baseLocation: { lat: 28.6315, lng: 77.2167 },
        route: "downtown" as const,
      },
      {
        id: "DL-01-EA-1087",
        name: "HiLoad · Karol Bagh",
        type: "HiLoad EV",
        baseLocation: { lat: 28.6508, lng: 77.1904 },
        route: "residential" as const,
      },
      {
        id: "DL-01-EA-1103",
        name: "HiLoad · Lajpat Nagar",
        type: "HiLoad EV",
        baseLocation: { lat: 28.5672, lng: 77.2430 },
        route: "downtown" as const,
      },
      {
        id: "DL-01-EA-1155",
        name: "HiLoad · Dwarka Sector 12",
        type: "HiLoad EV",
        baseLocation: { lat: 28.5921, lng: 77.0460 },
        route: "suburban" as const,
      },
      {
        id: "DL-01-EA-1198",
        name: "HiLoad · Rohini Sector 9",
        type: "HiLoad EV",
        baseLocation: { lat: 28.7333, lng: 77.1167 },
        route: "residential" as const,
      },
      {
        id: "HR-26-EA-2211",
        name: "HiLoad · Cyber City Gurugram",
        type: "HiLoad EV",
        baseLocation: { lat: 28.4950, lng: 77.0897 },
        route: "industrial" as const,
      },
      {
        id: "HR-26-EA-2248",
        name: "HiLoad · Golf Course Rd",
        type: "HiLoad EV",
        baseLocation: { lat: 28.4642, lng: 77.1023 },
        route: "suburban" as const,
      },
      {
        id: "UP-16-EA-3301",
        name: "HiLoad · Noida Sector 18",
        type: "HiLoad EV",
        baseLocation: { lat: 28.5672, lng: 77.3238 },
        route: "downtown" as const,
      },
      {
        id: "UP-16-EA-3345",
        name: "HiLoad · Noida Sector 62",
        type: "HiLoad EV",
        baseLocation: { lat: 28.6271, lng: 77.3698 },
        route: "industrial" as const,
      },
      {
        id: "DL-01-EA-1221",
        name: "HiLoad · Saket District Centre",
        type: "HiLoad EV",
        baseLocation: { lat: 28.5245, lng: 77.2066 },
        route: "residential" as const,
      },
      {
        id: "DL-01-EA-1267",
        name: "HiLoad · Okhla Industrial",
        type: "HiLoad EV",
        baseLocation: { lat: 28.5358, lng: 77.2735 },
        route: "industrial" as const,
      },
      {
        id: "HR-26-EA-2290",
        name: "HiLoad · Sohna Road Gurugram",
        type: "HiLoad EV",
        baseLocation: { lat: 28.4230, lng: 77.0350 },
        route: "highway" as const,
      },
    ]

    fleetDevices.forEach((device) => {
      const movementRange = this.getMovementRange(device.route)
      const speedMultiplier = this.getSpeedMultiplier(device.route)

      this.devices.set(device.id, {
        ...device,
        currentLocation: { ...device.baseLocation },
        currentMetrics: {
          temperature: 32,      // °C — Delhi ambient
          speed: 0,             // km/h
          fuel: 80 + Math.round(Math.random() * 20), // SOC 80–100% at start
          humidity: 50,
        },
        direction: {
          lat: (Math.random() - 0.5) * movementRange.lat,
          lng: (Math.random() - 0.5) * movementRange.lng,
        },
        speedMultiplier,
      })
    })
  }

  private getMovementRange(route: SimulationDevice["route"]) {
    switch (route) {
      case "highway":     return { lat: 0.002, lng: 0.005 }
      case "downtown":    return { lat: 0.001, lng: 0.001 }
      case "residential": return { lat: 0.0015, lng: 0.0015 }
      case "industrial":  return { lat: 0.0012, lng: 0.002 }
      case "suburban":    return { lat: 0.0018, lng: 0.0025 }
      default:            return { lat: 0.001, lng: 0.002 }
    }
  }

  private getSpeedMultiplier(route: SimulationDevice["route"]): number {
    switch (route) {
      case "highway":     return 1.2
      case "downtown":    return 0.55
      case "residential": return 0.75
      case "industrial":  return 1.0
      case "suburban":    return 0.9
      default:            return 1.0
    }
  }

  private getBaseSpeed(route: SimulationDevice["route"]): number {
    // km/h — HiLoad EV urban delivery speeds
    switch (route) {
      case "highway":     return 55
      case "downtown":    return 22
      case "residential": return 30
      case "industrial":  return 38
      case "suburban":    return 42
      default:            return 35
    }
  }

  private simulateMovement(device: SimulationDevice) {
    const drift = 0.1
    device.direction.lat += (Math.random() - 0.5) * drift
    device.direction.lng += (Math.random() - 0.5) * drift

    const magnitude = Math.sqrt(device.direction.lat ** 2 + device.direction.lng ** 2)
    if (magnitude > 0) {
      device.direction.lat /= magnitude
      device.direction.lng /= magnitude
    }

    const speed = device.currentMetrics.speed
    const movementScale = (speed / 100) * device.speedMultiplier * 0.0001

    device.currentLocation.lat += device.direction.lat * movementScale
    device.currentLocation.lng += device.direction.lng * movementScale

    // Clamp to Delhi NCR bounds
    device.currentLocation.lat = Math.max(NCR.minLat, Math.min(NCR.maxLat, device.currentLocation.lat))
    device.currentLocation.lng = Math.max(NCR.minLng, Math.min(NCR.maxLng, device.currentLocation.lng))

    // Occasionally reverse direction (simulate route changes)
    if (Math.random() < 0.05) {
      device.direction.lat *= -1
      device.direction.lng *= -1
    }
  }

  private simulateMetrics(device: SimulationDevice) {
    const baseSpeed = this.getBaseSpeed(device.route)
    const speedVariation = (Math.random() - 0.5) * 12
    const targetSpeed = baseSpeed * device.speedMultiplier + speedVariation

    // Traffic jam / clear road events
    const trafficFactor =
      Math.random() < 0.08 ? 0.25 :  // heavy traffic
      Math.random() < 0.05 ? 1.3  :  // clear road
      1.0

    device.currentMetrics.speed = Math.max(0, Math.min(65, targetSpeed * trafficFactor))

    // Battery temperature: Delhi ambient ≈ 35°C, rises with speed and load
    const ambientTemp = 33
    const speedHeat = device.currentMetrics.speed * 0.22
    const variation = (Math.random() - 0.5) * 3
    device.currentMetrics.temperature = Math.round(
      Math.max(26, Math.min(58, ambientTemp + speedHeat + variation)),
    )

    // SOC drains proportional to speed (EV energy model)
    if (device.currentMetrics.speed > 0) {
      const consumption =
        (device.currentMetrics.speed / 1000) * device.speedMultiplier +
        Math.random() * 0.04
      device.currentMetrics.fuel = Math.max(3, device.currentMetrics.fuel - consumption)
    }

    // Simulate arriving at depot / charging when SOC critically low
    if (device.currentMetrics.fuel < 8 && Math.random() < 0.12) {
      device.currentMetrics.fuel = 95
      device.currentMetrics.speed = 0
      device.currentLocation = { ...device.baseLocation }
      console.log(`[Sim] ${device.id} returned to depot — recharged to 95%`)
    }

    // Humidity — Delhi ambient humidity variation
    device.currentMetrics.humidity = Math.max(
      30,
      Math.min(85, device.currentMetrics.humidity + (Math.random() - 0.5) * 4),
    )
  }

  private async generateAndSendTelemetry(device: SimulationDevice) {
    this.simulateMovement(device)
    this.simulateMetrics(device)

    const telemetryData = {
      deviceId: device.id,
      timestamp: Date.now(),
      location: { ...device.currentLocation },
      metrics: { ...device.currentMetrics },
    }

    try {
      await insertTelemetry(telemetryData)
      emitTelemetryUpdate(telemetryData)
    } catch (error) {
      console.error(`Error sending telemetry for ${device.id}:`, error)
    }
  }

  async start() {
    if (this.isRunning) return

    this.isRunning = true
    console.log("🚀 Starting fleet simulation (Delhi NCR — Euler HiLoad EV)…")

    for (const device of this.devices.values()) {
      try {
        await upsertDevice(
          device.id,
          device.name,
          device.type,
          device.currentLocation,
          device.currentMetrics,
        )
      } catch (error) {
        console.error(`Error registering device ${device.id}:`, error)
      }
    }

    this.interval = setInterval(() => {
      if (this.isRunning) {
        this.devices.forEach((device) => {
          this.generateAndSendTelemetry(device).catch((error) => {
            console.error(`Error in simulation for ${device.id}:`, error)
          })
        })
      }
    }, this.updateInterval)

    console.log(`✅ Simulation started with ${this.devices.size} HiLoad EV devices`)
  }

  stop() {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    console.log("🛑 Simulation stopped")
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      deviceCount: this.devices.size,
    }
  }
}

let simulationEngine: SimulationEngine | null = null

export function getSimulationEngine(): SimulationEngine {
  if (!simulationEngine) {
    simulationEngine = new SimulationEngine()
  }
  return simulationEngine
}
