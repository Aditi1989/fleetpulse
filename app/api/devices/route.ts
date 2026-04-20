import { getAllDevices, upsertDevice } from "@/lib/db-devices"
import { maybeSyncShepherdBeforeDevicesFetch } from "@/lib/shepherd/devices-fetch-sync"
import { emitDeviceRegistered } from "@/lib/socket-server"
import { NextResponse } from "next/server"
import { z } from "zod"

const createDeviceSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  name: z.string().min(1, "Device name is required"),
  type: z.string().min(1, "Device type is required"),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  metrics: z
    .object({
      temperature: z.number().min(-50).max(200),
      speed: z.number().min(0).max(200),
      fuel: z.number().min(0).max(100),
      humidity: z.number().min(0).max(100).optional(),
    })
    .optional(),
})

export async function GET() {
  try {
    await maybeSyncShepherdBeforeDevicesFetch()
    const devices = await getAllDevices()
    return NextResponse.json({ devices })
  } catch (error) {
    console.error("Error fetching devices:", error)
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const validationResult = createDeviceSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { deviceId, name, type, location, metrics } = validationResult.data

    // Create or update device
    const device = await upsertDevice(deviceId, name, type, location, metrics)

    // Emit device registration event via Socket.IO
    emitDeviceRegistered(device)

    return NextResponse.json({ success: true, device })
  } catch (error) {
    console.error("Error creating device:", error)
    return NextResponse.json(
      { error: "Failed to create device" },
      { status: 500 }
    )
  }
}
