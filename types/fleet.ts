export interface Device {
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

export interface TelemetryData {
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

export interface FleetAlert {
  id: string
  deviceId: string
  type: "speed" | "temperature" | "fuel" | "geofence"
  message: string
  severity: "low" | "medium" | "high"
  timestamp: number
}

