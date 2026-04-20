"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck, Thermometer, Gauge, BatteryMedium, MapPin, Route } from "lucide-react"
import type { Device } from "@/types/fleet"

// Euler HiLoad EV max range in km
const HILOAD_MAX_RANGE_KM = 151

function estimatedRange(soc: number): number {
  return Math.round((soc / 100) * HILOAD_MAX_RANGE_KM)
}

interface DeviceCardProps {
  device: Device
  onClick: () => void
  isSelected: boolean
}

export function DeviceCard({ device, onClick, isSelected }: DeviceCardProps) {
  const getStatusColor = (status: Device["status"]) => {
    switch (status) {
      case "online":  return "bg-green-500"
      case "warning": return "bg-orange-500"
      case "offline": return "bg-red-500"
      default:        return "bg-gray-500"
    }
  }

  const getStatusVariant = (status: Device["status"]): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "online":  return "default"
      case "warning": return "secondary"
      case "offline": return "destructive"
      default:        return "outline"
    }
  }

  const soc   = Math.round(device.metrics.fuel)
  const speed = Math.round(device.metrics.speed)
  const temp  = Math.round(device.metrics.temperature)
  const range = estimatedRange(soc)
  const rangeColor =
    soc < 15 ? "text-red-600" :
    soc < 30 ? "text-orange-500" :
    "text-emerald-600"

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            <CardTitle className="text-base leading-tight">{device.name}</CardTitle>
          </div>
          <Badge variant={getStatusVariant(device.status)}>
            <div className={`w-2 h-2 rounded-full mr-1 ${getStatusColor(device.status)}`} />
            {device.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* SOC bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <BatteryMedium className="h-3.5 w-3.5" />
              Battery (SOC)
            </span>
            <span className={`font-semibold ${rangeColor}`}>{soc}%</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                soc < 15 ? "bg-red-500" : soc < 30 ? "bg-orange-400" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.max(soc, 2)}%` }}
            />
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>{speed} km/h</span>
          </div>
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>{temp}°C</span>
          </div>
          <div className={`flex items-center gap-2 ${rangeColor}`}>
            <Route className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">~{range} km</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate text-xs">
              {device.location.lat.toFixed(3)}, {device.location.lng.toFixed(3)}
            </span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-2">
          Updated: {new Date(device.lastUpdate).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
}
