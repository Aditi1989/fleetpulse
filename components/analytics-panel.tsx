"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Device, FleetAlert, TelemetryData } from "@/types/fleet"
import {
  Battery,
  BatteryLow,
  BatteryMedium,
  Flame,
  Gauge,
  ShieldAlert,
  ThumbsUp,
  Truck,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react"
import { useMemo } from "react"

// HiLoad EV max range in km
const MAX_RANGE_KM = 151

interface AnalyticsPanelProps {
  devices: Device[]
  alerts: FleetAlert[]
  telemetryHistory: Record<string, TelemetryData[]>
}

// ── helpers ────────────────────────────────────────────────────────────────────

function avg(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function pct(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

// ── sub-components ─────────────────────────────────────────────────────────────

/** Score chip — green/amber/red based on value */
function ScoreChip({ value, label, icon: Icon }: { value: number; label: string; icon: React.ElementType }) {
  const color =
    value >= 75 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    value >= 50 ? "text-amber-600 bg-amber-50 border-amber-200" :
                  "text-red-600 bg-red-50 border-red-200"
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border p-4 gap-1 ${color}`}>
      <Icon className="h-5 w-5" />
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs font-medium text-center">{label}</span>
    </div>
  )
}

/** Compact stat row */
function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold">{value}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export function AnalyticsPanel({ devices, alerts, telemetryHistory }: AnalyticsPanelProps) {
  const n = devices.length

  // ── 1. Fleet Health KPIs ───────────────────────────────────────────────────
  const onlineCount  = devices.filter((d) => d.status === "online").length
  const warningCount = devices.filter((d) => d.status === "warning").length
  const offlineCount = devices.filter((d) => d.status === "offline").length
  const movingCount  = devices.filter((d) => d.metrics.speed > 2).length
  const idleCount    = devices.filter((d) => d.metrics.speed <= 2 && d.status === "online").length

  const avgSOC   = Math.round(avg(devices.map((d) => d.metrics.fuel)))
  const avgSpeed = Math.round(avg(devices.map((d) => d.metrics.speed)))
  const avgTemp  = Math.round(avg(devices.map((d) => d.metrics.temperature)))
  const avgRange = Math.round((avgSOC / 100) * MAX_RANGE_KM)

  // Fleet efficiency score (0–100): penalise low SOC, high temp, offline vehicles
  const efficiencyScore = useMemo(() => {
    if (!n) return 0
    const socScore    = avgSOC                            // 0–100
    const tempScore   = Math.max(0, 100 - (avgTemp - 25) * 2) // ideal 25°C, penalty above
    const onlineScore = pct(onlineCount, n)
    return Math.round((socScore * 0.45 + tempScore * 0.25 + onlineScore * 0.30))
  }, [avgSOC, avgTemp, onlineCount, n])

  // Utilisation score: % of online vehicles actively moving
  const utilisationScore = onlineCount > 0 ? pct(movingCount, onlineCount) : 0

  // Battery health score: penalise vehicles with SOC < 20 or temp > 48
  const batteryHealthScore = useMemo(() => {
    if (!n) return 0
    const lowSOC  = devices.filter((d) => d.metrics.fuel < 20).length
    const highTemp = devices.filter((d) => d.metrics.temperature > 48).length
    const penalties = ((lowSOC + highTemp) / n) * 100
    return Math.max(0, Math.round(100 - penalties))
  }, [devices, n])

  // ── 2. SOC distribution buckets ────────────────────────────────────────────
  const socBuckets = useMemo(() => {
    const b = [
      { range: "0–20%",  count: 0, fill: "#ef4444" },
      { range: "21–40%", count: 0, fill: "#f97316" },
      { range: "41–60%", count: 0, fill: "#eab308" },
      { range: "61–80%", count: 0, fill: "#22c55e" },
      { range: "81–100%",count: 0, fill: "#10b981" },
    ]
    devices.forEach((d) => {
      const s = d.metrics.fuel
      if (s <= 20)       b[0].count++
      else if (s <= 40)  b[1].count++
      else if (s <= 60)  b[2].count++
      else if (s <= 80)  b[3].count++
      else               b[4].count++
    })
    return b
  }, [devices])

  // ── 3. Speed distribution buckets ─────────────────────────────────────────
  const speedBuckets = useMemo(() => [
    { range: "0 (parked)", count: devices.filter((d) => d.metrics.speed === 0).length, fill: "#94a3b8" },
    { range: "1–20",       count: devices.filter((d) => d.metrics.speed > 0  && d.metrics.speed <= 20).length, fill: "#60a5fa" },
    { range: "21–40",      count: devices.filter((d) => d.metrics.speed > 20 && d.metrics.speed <= 40).length, fill: "#3b82f6" },
    { range: "41–55",      count: devices.filter((d) => d.metrics.speed > 40 && d.metrics.speed <= 55).length, fill: "#1d4ed8" },
    { range: "55+",        count: devices.filter((d) => d.metrics.speed > 55).length, fill: "#ef4444" },
  ], [devices])

  // ── 4. Status donut ────────────────────────────────────────────────────────
  const statusData = [
    { name: "Online",  value: onlineCount,  fill: "#10b981" },
    { name: "Warning", value: warningCount, fill: "#f59e0b" },
    { name: "Offline", value: offlineCount, fill: "#ef4444" },
  ].filter((s) => s.value > 0)

  // ── 5. Alert breakdown ─────────────────────────────────────────────────────
  const alertCounts = useMemo(() => ({
    speed:       alerts.filter((a) => a.type === "speed").length,
    temperature: alerts.filter((a) => a.type === "temperature").length,
    fuel:        alerts.filter((a) => a.type === "fuel").length,
  }), [alerts])

  const alertPieData = [
    { name: "Speed",       value: alertCounts.speed,       fill: "#ef4444" },
    { name: "High Temp",   value: alertCounts.temperature, fill: "#f97316" },
    { name: "Low Battery", value: alertCounts.fuel,        fill: "#eab308" },
  ].filter((a) => a.value > 0)

  // ── 6. Per-vehicle SOC + range for ranked table ────────────────────────────
  const vehicleRanking = useMemo(() =>
    [...devices]
      .sort((a, b) => a.metrics.fuel - b.metrics.fuel)
      .slice(0, 8)
  , [devices])

  // ── 7. Telemetry speed trend (last 15 data points across all vehicles) ─────
  const speedTrend = useMemo(() => {
    // Flatten all telemetry, sort by timestamp, take last 15 unique timestamps
    const all: { t: number; speed: number }[] = []
    Object.values(telemetryHistory).forEach((hist) => {
      hist.forEach((pt) => all.push({ t: pt.timestamp, speed: pt.metrics.speed }))
    })
    all.sort((a, b) => a.t - b.t)
    // Group into 15 buckets
    if (all.length < 2) return []
    const bucketSize = Math.max(1, Math.floor(all.length / 15))
    const buckets: { time: string; speed: number }[] = []
    for (let i = 0; i < all.length; i += bucketSize) {
      const slice = all.slice(i, i + bucketSize)
      buckets.push({
        time: new Date(slice[slice.length - 1].t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        speed: Math.round(avg(slice.map((s) => s.speed))),
      })
    }
    return buckets.slice(-15)
  }, [telemetryHistory])

  // ── 8. Temperature trend ───────────────────────────────────────────────────
  const tempTrend = useMemo(() => {
    const all: { t: number; temp: number }[] = []
    Object.values(telemetryHistory).forEach((hist) => {
      hist.forEach((pt) => all.push({ t: pt.timestamp, temp: pt.metrics.temperature }))
    })
    all.sort((a, b) => a.t - b.t)
    if (all.length < 2) return []
    const bucketSize = Math.max(1, Math.floor(all.length / 15))
    const buckets: { time: string; temp: number }[] = []
    for (let i = 0; i < all.length; i += bucketSize) {
      const slice = all.slice(i, i + bucketSize)
      buckets.push({
        time: new Date(slice[slice.length - 1].t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        temp: Math.round(avg(slice.map((s) => s.temp))),
      })
    }
    return buckets.slice(-15)
  }, [telemetryHistory])

  // ── 9. Zone breakdown (by registration prefix) ────────────────────────────
  const zones = useMemo(() => {
    const dl = devices.filter((d) => d.id.startsWith("DL")).length
    const hr = devices.filter((d) => d.id.startsWith("HR")).length
    const up = devices.filter((d) => d.id.startsWith("UP")).length
    const other = devices.length - dl - hr - up
    return [
      { zone: "Delhi (DL)",    count: dl,    fill: "#6366f1" },
      { zone: "Gurugram (HR)", count: hr,    fill: "#8b5cf6" },
      { zone: "Noida (UP)",    count: up,    fill: "#a855f7" },
      ...(other > 0 ? [{ zone: "Other", count: other, fill: "#94a3b8" }] : []),
    ]
  }, [devices])

  // ── 10. Predictive watchlist ───────────────────────────────────────────────
  const needsCharging  = devices.filter((d) => d.metrics.fuel < 25)
  const highTempRisk   = devices.filter((d) => d.metrics.temperature > 48)
  const lowSpeedOnline = devices.filter((d) => d.status === "online" && d.metrics.speed < 3)

  // ─────────────────────────────────────────────────────────────────────────────
  if (!n) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No vehicle data — start the simulation to see analytics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Section 1: Fleet Health Scores ──────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Fleet Health Scores
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <ScoreChip value={efficiencyScore}    label="Fleet Efficiency"   icon={ThumbsUp} />
          <ScoreChip value={utilisationScore}   label="Utilisation"        icon={Gauge} />
          <ScoreChip value={batteryHealthScore} label="Battery Health"     icon={Battery} />
          <ScoreChip value={avgSOC}             label="Avg SOC %"          icon={BatteryMedium} />
          <ScoreChip value={avgSpeed}           label="Avg Speed km/h"     icon={TrendingUp} />
          <ScoreChip value={avgTemp}            label="Avg Temp °C"        icon={Flame} />
        </div>
      </div>

      {/* ── Section 2: Activity Breakdown + SOC Distribution ─────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Activity donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vehicle Status</CardTitle>
            <CardDescription>Online / Warning / Offline across {n} vehicles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-44 w-44 flex-shrink-0">
                <ResponsiveContainer width="100%" height={176}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={48} outerRadius={70}
                      paddingAngle={3}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} vehicles`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-sm flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Online
                  </span>
                  <span className="font-semibold">{onlineCount} ({pct(onlineCount, n)}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Warning
                  </span>
                  <span className="font-semibold">{warningCount} ({pct(warningCount, n)}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Offline
                  </span>
                  <span className="font-semibold">{offlineCount} ({pct(offlineCount, n)}%)</span>
                </div>
                <hr className="my-1" />
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Moving</span>
                  <span>{movingCount} vehicles</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Idling</span>
                  <span>{idleCount} vehicles</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SOC distribution bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Battery SOC Distribution</CardTitle>
            <CardDescription>How many vehicles are in each charge band</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={socBuckets} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v} vehicles`, "Count"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {socBuckets.map((entry) => (
                      <Cell key={entry.range} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-red-500">{socBuckets[0].count}</span> critical (&lt;20%)
              </span>
              <span>
                <span className="font-medium text-emerald-600">{socBuckets[3].count + socBuckets[4].count}</span> healthy (&gt;60%)
              </span>
              <span>Avg <strong>{avgSOC}%</strong> · Range <strong>~{avgRange} km</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3: Speed & Temperature Trends ────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fleet Speed Trend</CardTitle>
            <CardDescription>Average speed across fleet over recent telemetry</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={208}>
              <LineChart data={speedTrend} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} unit=" km/h" />
                <Tooltip formatter={(v: number) => [`${v} km/h`, "Avg Speed"]} />
                <Line
                  type="monotone" dataKey="speed"
                  stroke="#3b82f6" strokeWidth={2}
                  dot={false} activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Battery Temperature Trend</CardTitle>
            <CardDescription>Average battery temperature across fleet</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={208}>
              <LineChart data={tempTrend} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} unit="°C" />
                <Tooltip formatter={(v: number) => [`${v}°C`, "Avg Temp"]} />
                <Line
                  type="monotone" dataKey="temp"
                  stroke="#f97316" strokeWidth={2}
                  dot={false} activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 4: Speed Distribution + Zone Breakdown ───────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Speed Distribution</CardTitle>
            <CardDescription>Number of vehicles in each speed band (km/h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={speedBuckets} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="range" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v: number) => [`${v} vehicles`, "Count"]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {speedBuckets.map((entry) => (
                      <Cell key={entry.range} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Zone Coverage</CardTitle>
            <CardDescription>Fleet distribution by operating zone</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-44 w-44 flex-shrink-0">
                <ResponsiveContainer width="100%" height={176}>
                  <PieChart>
                    <Pie
                      data={zones}
                      dataKey="count"
                      nameKey="zone"
                      cx="50%" cy="50%"
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {zones.map((z) => (
                        <Cell key={z.zone} fill={z.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} vehicles`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 text-sm">
                {zones.map((z) => (
                  <div key={z.zone} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: z.fill }} />
                      {z.zone}
                    </span>
                    <span className="font-semibold">{z.count} ({pct(z.count, n)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 5: Vehicle Range Ranking ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vehicle Range Ranking</CardTitle>
          <CardDescription>
            Vehicles sorted by remaining range — lowest first. HiLoad EV max range {MAX_RANGE_KM} km.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {vehicleRanking.map((device) => {
              const soc   = Math.round(device.metrics.fuel)
              const range = Math.round((soc / 100) * MAX_RANGE_KM)
              const barColor = soc < 20 ? "#ef4444" : soc < 40 ? "#f97316" : "#10b981"
              return (
                <div key={device.id} className="flex items-center gap-3 text-sm">
                  <div className="w-36 shrink-0 truncate text-muted-foreground" title={device.name}>
                    {device.name.replace("HiLoad - ", "")}
                  </div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(soc, 2)}%`, background: barColor }}
                    />
                  </div>
                  <div className="w-16 text-right shrink-0">
                    <span className="font-semibold">{soc}%</span>
                    <span className="text-xs text-muted-foreground ml-1">~{range} km</span>
                  </div>
                  <Badge
                    variant={device.status === "warning" ? "secondary" : device.status === "offline" ? "destructive" : "default"}
                    className="w-16 justify-center text-xs shrink-0"
                  >
                    {device.status}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 6: Alert Analytics ───────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Alert Breakdown</CardTitle>
            <CardDescription>{alerts.length} total alerts recorded this session</CardDescription>
          </CardHeader>
          <CardContent>
            {alertPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-40 w-40 flex-shrink-0">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={alertPieData} dataKey="value" cx="50%" cy="50%"
                           innerRadius={36} outerRadius={58} paddingAngle={3}>
                        {alertPieData.map((a) => <Cell key={a.name} fill={a.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} alerts`]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-red-600">
                      <Gauge className="h-3.5 w-3.5" /> Speed
                    </span>
                    <span className="font-semibold">{alertCounts.speed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-orange-600">
                      <Flame className="h-3.5 w-3.5" /> High Temp
                    </span>
                    <span className="font-semibold">{alertCounts.temperature}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-yellow-600">
                      <BatteryLow className="h-3.5 w-3.5" /> Low Battery
                    </span>
                    <span className="font-semibold">{alertCounts.fuel}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No alerts recorded yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fleet Performance Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance Summary</CardTitle>
            <CardDescription>Key fleet metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <StatRow label="Total Vehicles"         value={n} />
            <StatRow label="Active / Moving"        value={`${movingCount} / ${n}`} sub={`${pct(movingCount, n)}% utilisation`} />
            <StatRow label="Avg Battery SOC"        value={`${avgSOC}%`} sub={`~${avgRange} km est. range`} />
            <StatRow label="Avg Speed"              value={`${avgSpeed} km/h`} />
            <StatRow label="Avg Battery Temp"       value={`${avgTemp}°C`} />
            <StatRow label="Vehicles < 25% SOC"     value={needsCharging.length} sub="Needs charging soon" />
            <StatRow label="High Temp Risk (&gt;48°C)" value={highTempRisk.length} sub="Monitor closely" />
            <StatRow label="Total Alerts"           value={alerts.length} />
          </CardContent>
        </Card>
      </div>

      {/* ── Section 7: Predictive Watchlist ──────────────────────────────────── */}
      {(needsCharging.length > 0 || highTempRisk.length > 0) && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Predictive Watchlist
            </CardTitle>
            <CardDescription>Vehicles requiring attention based on current telemetry</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {needsCharging.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <BatteryLow className="h-3.5 w-3.5" /> Charging Needed Soon (SOC &lt; 25%)
                  </p>
                  <div className="space-y-1">
                    {needsCharging.map((d) => (
                      <div key={d.id} className="flex justify-between text-sm py-1 border-b border-amber-100 last:border-0">
                        <span className="text-muted-foreground truncate max-w-[160px]">{d.name.replace("HiLoad - ", "")}</span>
                        <span className="font-semibold text-amber-700 flex items-center gap-2">
                          {Math.round(d.metrics.fuel)}%
                          <span className="text-xs text-muted-foreground">~{Math.round((d.metrics.fuel / 100) * MAX_RANGE_KM)} km</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {highTempRisk.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5" /> High Battery Temperature (&gt; 48°C)
                  </p>
                  <div className="space-y-1">
                    {highTempRisk.map((d) => (
                      <div key={d.id} className="flex justify-between text-sm py-1 border-b border-red-100 last:border-0">
                        <span className="text-muted-foreground truncate max-w-[160px]">{d.name.replace("HiLoad - ", "")}</span>
                        <span className="font-semibold text-red-700">{Math.round(d.metrics.temperature)}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Energy efficiency insights */}
            <div className="mt-4 pt-4 border-t border-amber-200">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" /> Energy Efficiency Insight
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Fleet avg SOC: <strong>{avgSOC}%</strong> → estimated combined range:{" "}
                  <strong>{Math.round((avgSOC / 100) * MAX_RANGE_KM * n)} km</strong> across {n} vehicles.
                </p>
                <p>
                  {movingCount} vehicles moving, {idleCount} idling online.{" "}
                  {idleCount > 0 && (
                    <span className="text-amber-700">
                      Consider reassigning {idleCount} idling vehicle{idleCount > 1 ? "s" : ""} to active routes.
                    </span>
                  )}
                </p>
                <p>
                  {efficiencyScore >= 75 ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 inline" /> Fleet operating efficiently.
                    </span>
                  ) : (
                    <span className="text-red-700 flex items-center gap-1">
                      <TrendingDown className="h-3.5 w-3.5 inline" /> Fleet efficiency below target — review charging schedule and offline vehicles.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
