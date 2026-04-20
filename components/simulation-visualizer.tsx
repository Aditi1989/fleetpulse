"use client"

import { Activity, BatteryMedium, Gauge, MapPin, Thermometer, Truck } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Device } from "@/types/fleet"

interface SimulationVisualizerProps {
  devices: Device[]
  isRunning: boolean
}

export function SimulationVisualizer({ devices, isRunning }: SimulationVisualizerProps) {
  const [vehiclePosition, setVehiclePosition] = useState(0)

  const averageSpeed = useMemo(() => {
    if (devices.length === 0) return 0
    const total = devices.reduce((acc, device) => acc + device.metrics.speed, 0)
    return total / devices.length
  }, [devices])

  const averageTemperature = useMemo(() => {
    if (devices.length === 0) return 0
    const total = devices.reduce((acc, device) => acc + device.metrics.temperature, 0)
    return total / devices.length
  }, [devices])

  const averageFuel = useMemo(() => {
    if (devices.length === 0) return 0
    const total = devices.reduce((acc, device) => acc + device.metrics.fuel, 0)
    return total / devices.length
  }, [devices])

  const leadingDevice = useMemo(() => {
    if (devices.length === 0) return null
    return devices.reduce((fastest, device) => {
      if (!fastest) return device
      return device.metrics.speed > fastest.metrics.speed ? device : fastest
    }, devices[0])
  }, [devices])

  useEffect(() => {
    if (!isRunning) {
      setVehiclePosition(0)
      return
    }

    let animationFrame: number
    const animate = () => {
      setVehiclePosition((prev) => {
        const increment = Math.min(1.5, Math.max(0.2, averageSpeed / 90 || 0))
        return (prev + increment) % 100
      })
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [isRunning, averageSpeed])

  const hasDevices = devices.length > 0

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>FleetPulse</CardTitle>
        <CardDescription>
          {isRunning
            ? hasDevices
              ? "Live vehicle movement driven by the telemetry stream"
              : "Simulation running — waiting for devices to report in"
            : "Press Start Simulation to visualize movement and stats"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative h-24 overflow-hidden rounded-2xl border border-dashed border-muted bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/40 dark:to-slate-900/20">
          <div className="absolute inset-4 rounded-full border border-muted bg-background/80 shadow-inner" />
          <div className="absolute inset-x-10 top-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Depot</span>
            <div className="flex items-center gap-1 text-primary">
              <Activity className="h-3 w-3" />
              {isRunning ? "Live" : "Idle"}
            </div>
            <span>Route</span>
          </div>
          <div
            className={`absolute top-1/2 flex h-12 w-20 -translate-y-1/2 items-center justify-center rounded-full border text-white transition-all duration-200 ${isRunning ? "bg-primary shadow-lg shadow-primary/40" : "bg-muted-foreground/60"
              }`}
            style={{ left: `calc(${vehiclePosition}% - 40px)` }}
          >
            <Truck className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Gauge className="h-4 w-4 text-primary" />
              Speed
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {hasDevices ? `${Math.round(averageSpeed)} km/h` : "--"}
            </p>
            <p className="text-xs text-muted-foreground">Fleet average</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Thermometer className="h-4 w-4 text-orange-500" />
              Battery Temp
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {hasDevices ? `${Math.round(averageTemperature)}°C` : "--"}
            </p>
            <p className="text-xs text-muted-foreground">Battery average</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <BatteryMedium className="h-4 w-4 text-emerald-500" />
              Battery (SOC)
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {hasDevices ? `${Math.round(averageFuel)}%` : "--"}
            </p>
            <p className="text-xs text-muted-foreground">Fleet average</p>
          </div>
        </div>

        {leadingDevice && (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Leading vehicle</p>
                <p className="text-base font-semibold text-foreground">{leadingDevice.name}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-foreground">
                  {Math.round(leadingDevice.metrics.speed)} km/h
                </p>
                <p className="text-xs">
                  Updated {new Date(leadingDevice.lastUpdate).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
              <div className="flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5 text-orange-500" />
                {Math.round(leadingDevice.metrics.temperature)}°C
              </div>
              <div className="flex items-center gap-1">
                <BatteryMedium className="h-3.5 w-3.5 text-emerald-500" />
                SOC {Math.round(leadingDevice.metrics.fuel)}%
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {leadingDevice.location.lat.toFixed(3)}, {leadingDevice.location.lng.toFixed(3)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

