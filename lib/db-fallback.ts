import { getSampleDevices } from "./sample-data"

interface Device {
  id: string
  name: string
  type: string
  status: "online" | "offline" | "warning"
  location: { lat: number; lng: number }
  metrics: {
    temperature: number
    speed: number
    fuel: number
    humidity?: number
  }
  lastUpdate: string
}

interface TelemetryData {
  deviceId: string
  timestamp: number
  location: { lat: number; lng: number }
  metrics: {
    temperature: number
    speed: number
    fuel: number
    humidity?: number
  }
}

interface Alert {
  id: string
  deviceId: string
  type: "speed" | "temperature" | "fuel" | "geofence"
  message: string
  severity: "low" | "medium" | "high"
  timestamp: number
}

class InMemoryStore {
  private devices: Map<string, Device> = new Map()
  private telemetry: Map<string, TelemetryData[]> = new Map()
  private alerts: Alert[] = []

  // Device operations
  getAllDevices(): Device[] {
    return Array.from(this.devices.values())
  }

  getDeviceById(deviceId: string): Device | null {
    return this.devices.get(deviceId) || null
  }

  upsertDevice(device: Device): Device {
    this.devices.set(device.id, device)
    return device
  }

  updateDeviceStatus(deviceId: string, status: Device["status"]): void {
    const device = this.devices.get(deviceId)
    if (device) {
      device.status = status
      device.lastUpdate = new Date().toISOString()
    }
  }

  // Telemetry operations
  insertTelemetry(data: TelemetryData): void {
    if (!this.telemetry.has(data.deviceId)) {
      this.telemetry.set(data.deviceId, [])
    }
    const history = this.telemetry.get(data.deviceId)!
    history.push(data)
    if (history.length > 1000) {
      history.shift()
    }
  }

  getTelemetryHistory(deviceId: string, limit = 100): TelemetryData[] {
    const history = this.telemetry.get(deviceId) || []
    return history.slice(-limit).reverse()
  }

  // Alert operations
  insertAlert(alert: Alert): Alert {
    this.alerts.unshift(alert)
    if (this.alerts.length > 500) {
      this.alerts.pop()
    }
    return alert
  }

  getAlerts(deviceId?: string, limit = 100): Alert[] {
    let alerts = this.alerts
    if (deviceId) {
      alerts = alerts.filter((a) => a.deviceId === deviceId)
    }
    return alerts.slice(0, limit)
  }
}

let inMemoryStore: InMemoryStore | null = null

export function getInMemoryStore(): InMemoryStore {
  if (!inMemoryStore) {
    inMemoryStore = new InMemoryStore()

    // Seed with Euler HiLoad EV sample fleet (Delhi NCR)
    getSampleDevices().forEach((device) => {
      inMemoryStore!.upsertDevice(device)
    })
  }
  return inMemoryStore
}
