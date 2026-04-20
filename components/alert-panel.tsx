import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Fuel, Gauge, MapPin, Thermometer } from "lucide-react"

interface Alert {
  id: string
  deviceId: string
  type: "speed" | "temperature" | "fuel" | "geofence"
  message: string
  severity: "low" | "medium" | "high"
  timestamp: number
}

interface AlertPanelProps {
  alerts: Alert[]
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "speed":
        return <Gauge className="h-4 w-4" />
      case "temperature":
        return <Thermometer className="h-4 w-4" />
      case "fuel":
        return <Fuel className="h-4 w-4" />
      case "geofence":
        return <MapPin className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getSeverityVariant = (severity: Alert["severity"]) => {
    switch (severity) {
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      case "low":
        return "outline"
      default:
        return "outline"
    }
  }

  const getSeverityColor = (severity: Alert["severity"]) => {
    switch (severity) {
      case "high":
        return "text-red-600"
      case "medium":
        return "text-orange-600"
      case "low":
        return "text-yellow-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fleet Alerts</CardTitle>
        <CardDescription>
          {alerts.length} total alerts • {alerts.filter((a) => Date.now() - a.timestamp < 300000).length} active
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No alerts to display</div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 50).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className={`mt-0.5 ${getSeverityColor(alert.severity)}`}>{getAlertIcon(alert.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getSeverityVariant(alert.severity)} className="text-xs">
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {alert.deviceId}
                    </Badge>
                  </div>
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
