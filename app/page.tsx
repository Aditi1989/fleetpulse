"use client"

import { AlertPanel } from "@/components/alert-panel"
import { AnalyticsPanel } from "@/components/analytics-panel"
import { DeviceCard } from "@/components/device-card"
import { SimulationVisualizer } from "@/components/simulation-visualizer"
import dynamic from "next/dynamic"

// Leaflet requires browser APIs — disable SSR to prevent server-side crash
const FleetMap = dynamic(() => import("@/components/fleet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-50">
      <div className="text-center text-gray-500">
        <div className="animate-spin text-3xl mb-2">🗺️</div>
        <div className="text-sm">Loading map…</div>
      </div>
    </div>
  ),
})
import { TelemetryChart } from "@/components/telemetry-chart"
import { AlertDescription, Alert as UIAlert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { getSampleDevices, getSampleTelemetryHistory, simulateSampleDevice } from "@/lib/sample-data"
import type { Device, FleetAlert, TelemetryData } from "@/types/fleet"
import { AlertTriangle, Gauge, Pause, Play, Thermometer, Truck } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import io from "socket.io-client"

export default function FleetDashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [telemetryHistory, setTelemetryHistory] = useState<Record<string, TelemetryData[]>>({})
  const [alerts, setAlerts] = useState<FleetAlert[]>([])
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [isUsingSampleData, setIsUsingSampleData] = useState(true)
  const { toast } = useToast()

  // Rate limit alerts so the same condition doesn't trigger continuously
  const alertCooldownMs = 60_000 // 1 minute per device/alert type
  const lastAlertTimesRef = useRef<Record<string, number>>({})

  const shouldRateLimitAlert = (key: string, timestamp: number) => {
    const last = lastAlertTimesRef.current[key] ?? 0
    if (timestamp - last < alertCooldownMs) {
      return true
    }
    lastAlertTimesRef.current[key] = timestamp
    return false
  }

  useEffect(() => {
    // Check simulation status and auto-start if not already running
    const initSimulation = async () => {
      try {
        const res = await fetch("/api/simulation")
        if (!res.ok) return
        const status = await res.json()
        if (status?.isRunning) {
          setIsSimulationRunning(true)
          return
        }
        // Auto-start simulation so vehicles show live positions immediately
        const startRes = await fetch("/api/simulation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) })
        if (startRes.ok) {
          setIsSimulationRunning(true)
        }
      } catch (error) {
        console.error("Failed to initialise simulation:", error)
      }
    }

    initSimulation()
  }, [])

  useEffect(() => {
    // Initialize Socket.IO connection
    const socket = io({
      path: "/api/socket",
    })

    // Listen for real-time telemetry updates
    socket.on("telemetry-update", (data: TelemetryData) => {
      setIsUsingSampleData(false)

      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.id === data.deviceId)
        if (idx === -1) {
          checkAlerts(data)
          const added: Device = {
            id: data.deviceId,
            name: data.deviceId,
            type: "vehicle",
            status: getDeviceStatus(data.metrics),
            location: data.location,
            metrics: data.metrics,
            lastUpdate: new Date(data.timestamp).toISOString(),
          }
          return [...prev, added]
        }
        return prev.map((device) => {
          if (device.id === data.deviceId) {
            checkAlerts(data)
            return {
              ...device,
              location: data.location,
              metrics: data.metrics,
              lastUpdate: new Date(data.timestamp).toISOString(),
              status: getDeviceStatus(data.metrics),
            }
          }
          return device
        })
      })

      setTelemetryHistory((prev) => ({
        ...prev,
        [data.deviceId]: [...(prev[data.deviceId] || []).slice(-50), data],
      }))
    })

    // Listen for new device registrations
    socket.on("device-registered", (device: Device) => {
      setDevices((prev) => [...prev, device])
      toast({
        title: "New Device Online",
        description: `${device.name} has joined the fleet`,
      })
    })

    // Load initial devices
    loadDevices()

    return () => {
      socket.disconnect()
    }
    // loadDevices + checkAlerts are stable enough for initial mount; full deps would re-bind socket every render
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast only; loadDevices/checkAlerts intentionally omitted
  }, [toast])

  const loadDevices = async () => {
    try {
      const response = await fetch("/api/devices")
      if (!response.ok) {
        throw new Error("Failed to fetch devices")
      }
      const data = await response.json()
      if (data.devices && data.devices.length > 0) {
        setDevices(data.devices)
        setIsUsingSampleData(false)
        // Pre-seed history even when loading from API so trend charts have initial data
        setTelemetryHistory(getSampleTelemetryHistory())
        return
      }
    } catch (error) {
      console.error("Failed to load devices:", error)
    }

    const sampleDevices = getSampleDevices()
    setDevices(sampleDevices)
    setIsUsingSampleData(true)
    // Pre-seed 20 historical points per vehicle so trend charts render immediately
    setTelemetryHistory(getSampleTelemetryHistory())
  }

  const getDeviceStatus = (metrics: TelemetryData["metrics"]): Device["status"] => {
    if (metrics.temperature > 55 || metrics.speed > 80 || metrics.fuel < 15) {
      return "warning"
    }
    return "online"
  }

  const checkAlerts = (data: TelemetryData) => {
    const newAlerts: FleetAlert[] = []

    if (data.metrics.speed > 80 && !shouldRateLimitAlert(`${data.deviceId}-speed`, data.timestamp)) {
      newAlerts.push({
        id: `${data.deviceId}-speed-${Date.now()}`,
        deviceId: data.deviceId,
        type: "speed",
        message: `Vehicle ${data.deviceId} exceeding speed limit: ${data.metrics.speed} km/h`,
        severity: "high",
        timestamp: data.timestamp,
      })
    }

    if (data.metrics.temperature > 55 && !shouldRateLimitAlert(`${data.deviceId}-temperature`, data.timestamp)) {
      newAlerts.push({
        id: `${data.deviceId}-temp-${Date.now()}`,
        deviceId: data.deviceId,
        type: "temperature",
        message: `High battery temperature detected: ${data.metrics.temperature}°C`,
        severity: "medium",
        timestamp: data.timestamp,
      })
    }

    if (data.metrics.fuel < 15 && !shouldRateLimitAlert(`${data.deviceId}-fuel`, data.timestamp)) {
      newAlerts.push({
        id: `${data.deviceId}-fuel-${Date.now()}`,
        deviceId: data.deviceId,
        type: "fuel",
        message: `Low battery (SOC): ${data.metrics.fuel}% — Est. range ~${Math.round((data.metrics.fuel / 100) * 151)} km`,
        severity: "medium",
        timestamp: data.timestamp,
      })
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 100)) // Keep last 100 alerts

      newAlerts.forEach((alert) => {
        toast({
          title: "Fleet Alert",
          description: alert.message,
          variant: alert.severity === "high" ? "destructive" : "default",
        })
      })
    }
  }

  const toggleSimulation = async () => {
    try {
      const response = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isSimulationRunning ? "stop" : "start" }),
      })

      if (response.ok) {
        setIsSimulationRunning(!isSimulationRunning)
        toast({
          title: isSimulationRunning ? "Simulation Stopped" : "Simulation Started",
          description: isSimulationRunning ? "Fleet simulation has been stopped" : "Fleet simulation is now running",
        })
      }
    } catch (error) {
      console.error("Failed to toggle simulation:", error)
    }
  }

  const activeAlerts = alerts.filter(
    (alert) => Date.now() - alert.timestamp < 300000, // Last 5 minutes
  )

  useEffect(() => {
    if (!isUsingSampleData) {
      return
    }

    const interval = setInterval(() => {
      setDevices((prevDevices) => {
        const updatedDevices: Device[] = []
        const telemetryBatch: TelemetryData[] = []

        prevDevices.forEach((device) => {
          const { device: updatedDevice, telemetry } = simulateSampleDevice(device)
          updatedDevices.push(updatedDevice)
          telemetryBatch.push(telemetry)
        })

        setTelemetryHistory((prevHistory) => {
          const updatedHistory = { ...prevHistory }
          telemetryBatch.forEach((entry) => {
            const history = updatedHistory[entry.deviceId] || []
            updatedHistory[entry.deviceId] = [...history.slice(-49), entry]
          })
          return updatedHistory
        })

        telemetryBatch.forEach((entry) => checkAlerts(entry))

        return updatedDevices
      })
    }, 2500)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkAlerts closes over latest state; interval only for sample mode
  }, [isUsingSampleData])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">FleetPulse</h1>
                <p className="text-sm text-muted-foreground">Real-time IoT Fleet Monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={isSimulationRunning ? "default" : "secondary"}>{devices.length} Devices</Badge>
              <Button
                onClick={toggleSimulation}
                variant={isSimulationRunning ? "destructive" : "default"}
                className="gap-2"
              >
                {isSimulationRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isSimulationRunning ? "Stop" : "Start"} Simulation
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="container mx-auto px-4 py-2">
          <UIAlert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {activeAlerts.length} active alert{activeAlerts.length > 1 ? "s" : ""} - Check the alerts panel for
              details
            </AlertDescription>
          </UIAlert>
        </div>
      )}

      <div className="container mx-auto px-4 py-6 space-y-6">
        <SimulationVisualizer devices={devices} isRunning={isSimulationRunning} />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="map">Live Map</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Fleet Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{devices.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {devices.filter((d) => d.status === "online").length} online
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Speed</CardTitle>
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {devices.length > 0
                      ? Math.round(devices.reduce((acc, d) => acc + d.metrics.speed, 0) / devices.length)
                      : 0}{" "}
                    km/h
                  </div>
                  <p className="text-xs text-muted-foreground">Fleet average</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Temperature</CardTitle>
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {devices.length > 0
                      ? Math.round(devices.reduce((acc, d) => acc + d.metrics.temperature, 0) / devices.length)
                      : 0}
                    °C
                  </div>
                  <p className="text-xs text-muted-foreground">Battery avg</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeAlerts.length}</div>
                  <p className="text-xs text-muted-foreground">Last 5 minutes</p>
                </CardContent>
              </Card>
            </div>

            {/* Device Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onClick={() => setSelectedDevice(device.id)}
                  isSelected={selectedDevice === device.id}
                />
              ))}
            </div>

            {/* Selected Device Telemetry */}
            {selectedDevice && telemetryHistory[selectedDevice] && (
              <Card>
                <CardHeader>
                  <CardTitle>Telemetry History - {selectedDevice}</CardTitle>
                  <CardDescription>Real-time sensor data over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <TelemetryChart data={telemetryHistory[selectedDevice]} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="map">
            <Card>
              <CardHeader>
                <CardTitle>Live Fleet Map</CardTitle>
                <CardDescription>Real-time vehicle positions and status</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[600px] w-full">
                  <FleetMap devices={devices} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsPanel
              devices={devices}
              alerts={alerts}
              telemetryHistory={telemetryHistory}
            />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertPanel alerts={alerts} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
