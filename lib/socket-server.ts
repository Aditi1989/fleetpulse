import { Server as SocketIOServer } from "socket.io"
import type { Server as HTTPServer } from "http"
import type { Device } from "./db-devices"
import type { TelemetryData } from "./db-telemetry"
import type { FleetAlert } from "@/types/fleet"

let io: SocketIOServer | null = null

// Initialize Socket.IO server
export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    path: "/api/socket",
  })

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`)

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`)
    })

    // Join device room for targeted updates
    socket.on("join-device", (deviceId: string) => {
      socket.join(`device:${deviceId}`)
      console.log(`Client ${socket.id} joined device room: ${deviceId}`)
    })

    // Leave device room
    socket.on("leave-device", (deviceId: string) => {
      socket.leave(`device:${deviceId}`)
      console.log(`Client ${socket.id} left device room: ${deviceId}`)
    })
  })

  return io
}

// Get Socket.IO instance
export function getSocketIO(): SocketIOServer | null {
  return io
}

// Emit telemetry update to all clients
export function emitTelemetryUpdate(data: TelemetryData): void {
  if (io) {
    io.emit("telemetry-update", data)
    // Also emit to device-specific room
    io.to(`device:${data.deviceId}`).emit("telemetry-update", data)
  }
}

// Emit device registration
export function emitDeviceRegistered(device: Device): void {
  if (io) {
    io.emit("device-registered", device)
  }
}

// Emit alert
export function emitAlert(alert: FleetAlert): void {
  if (io) {
    io.emit("alert", alert)
    // Also emit to device-specific room
    io.to(`device:${alert.deviceId}`).emit("alert", alert)
  }
}

