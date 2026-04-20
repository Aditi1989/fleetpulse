import { getSimulationEngine } from "@/lib/simulation-engine"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { action } = await request.json()
    const engine = getSimulationEngine()

    if (action === "start") {
      await engine.start()
      return NextResponse.json({
        success: true,
        message: "Simulation started",
        status: engine.getStatus(),
      })
    }

    if (action === "stop") {
      engine.stop()
      return NextResponse.json({
        success: true,
        message: "Simulation stopped",
        status: engine.getStatus(),
      })
    }

    return NextResponse.json(
      {
        success: false,
        message: `Invalid action: ${action}. Use 'start' or 'stop'`,
      },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error in simulation control:", error)
    return NextResponse.json(
      { error: "Failed to control simulation" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const engine = getSimulationEngine()
    const status = engine.getStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error("Error getting simulation status:", error)
    return NextResponse.json(
      { error: "Failed to get simulation status" },
      { status: 500 }
    )
  }
}
