"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

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

interface TelemetryChartProps {
  data: TelemetryData[]
}

export function TelemetryChart({ data }: TelemetryChartProps) {
  const chartData = data.slice(-20).map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString(),
    temperature: item.metrics.temperature,
    speed: item.metrics.speed,
    fuel: item.metrics.fuel,
  }))

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="speed" stroke="#8884d8" strokeWidth={2} name="Speed (km/h)" />
          <Line type="monotone" dataKey="temperature" stroke="#82ca9d" strokeWidth={2} name="Temp (°C)" />
          <Line type="monotone" dataKey="fuel" stroke="#ffc658" strokeWidth={2} name="Battery SOC (%)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
