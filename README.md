<<<<<<< HEAD
# FleetPulse - Real-time IoT Fleet Monitoring System

A comprehensive full-stack fleet monitoring system built with Next.js, PostgreSQL, and Socket.IO for real-time telemetry tracking, alerting, and analytics.

## 🚀 Features

- **Real-time Monitoring**: Live tracking of fleet vehicles with real-time telemetry updates
- **Interactive Map**: Visual fleet map showing device locations and status
- **Alert System**: Automated alerts for speed violations, temperature warnings, and fuel levels
- **Telemetry Analytics**: Historical data visualization with charts and graphs
- **Simulation Engine**: Advanced simulation system with realistic vehicle movement patterns
- **Database Integration**: PostgreSQL with PostGIS for geospatial queries
- **WebSocket Support**: Real-time communication via Socket.IO
- **Fallback Mode**: Works without database for demo purposes

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm
- PostgreSQL 14+ with PostGIS extension (optional - fallback mode available)
- TypeScript 5+

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd fleet-pulse
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:

   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/fleetpulse
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
   NODE_ENV=development
   ```

4. **Set up database (optional)**

   If you want to use PostgreSQL:

   ```bash
   # Create database
   createdb fleetpulse

   # Enable PostGIS extension
   psql -d fleetpulse -c "CREATE EXTENSION IF NOT EXISTS postgis;"

   # Run schema creation
   psql -d fleetpulse -f scripts/create-tables.sql

   # (Optional) Seed sample data
   psql -d fleetpulse -f scripts/seed-data.sql
   ```

   **Note**: The app will work in fallback mode without a database for demo purposes.

## 🏃 Running the Application

### Development Mode

With Socket.IO server (recommended):

```bash
npm run dev
```

Standard Next.js dev mode (without Socket.IO):

```bash
npm run dev:next
```

### Production Mode

```bash
npm run build
npm run start
```

The application will be available at `http://localhost:3000`

## 📊 Database Schema

The application uses the following tables:

- **devices**: Stores device information (id, name, type, status)
- **telemetry**: Time-series telemetry data (location, speed, temperature, fuel, humidity)
- **alerts**: Alert records with severity levels
- **geofences**: Geofence definitions (for future use)

See `scripts/create-tables.sql` for the complete schema.

## 🔌 API Endpoints

### Devices

- `GET /api/devices` - Get all devices
- `POST /api/devices` - Create/update a device

### Telemetry

- `POST /api/telemetry` - Submit telemetry data
- `GET /api/telemetry?deviceId=xxx&limit=100` - Get telemetry history

### Simulation

- `POST /api/simulation` - Start/stop simulation (`{action: "start"|"stop"}`)
- `GET /api/simulation` - Get simulation status

### Alerts

- `GET /api/alerts` - Get alerts (supports `deviceId`, `isActive`, `limit` query params)
- `POST /api/alerts` - Resolve an alert (`{action: "resolve", alertId: "123"}`)

## 🎮 Simulation Features

The simulation engine provides:

- **Route-based Movement**: Different movement patterns (highway, downtown, residential, industrial, suburban)
- **Realistic Metrics**: Speed, temperature, fuel consumption based on route type
- **Traffic Simulation**: Random traffic jams and clear road conditions
- **Fuel Consumption**: Realistic fuel consumption based on speed and route
- **Auto-refueling**: Automatic refueling when fuel is low

## 🔧 Configuration

### Alert Thresholds

Edit `app/api/telemetry/route.ts` to customize:

```typescript
const ALERT_THRESHOLDS = {
  speed: { high: 80, medium: 70 },
  temperature: { high: 85, medium: 80 },
  fuel: { low: 15, critical: 5 },
};
```

### Simulation Settings

Edit `lib/simulation-engine.ts` to customize:

- Update intervals
- Device configurations
- Route types and behaviors

## 📁 Project Structure

```
fleet-pulse/
├── app/
│   ├── api/              # API routes
│   │   ├── devices/      # Device management
│   │   ├── telemetry/    # Telemetry endpoints
│   │   ├── simulation/   # Simulation control
│   │   └── alerts/       # Alert management
│   ├── page.tsx          # Main dashboard
│   └── layout.tsx        # Root layout
├── components/          # React components
│   ├── fleet-map.tsx    # Map visualization
│   ├── device-card.tsx  # Device cards
│   ├── alert-panel.tsx  # Alert display
│   └── telemetry-chart.tsx # Charts
├── lib/
│   ├── db.ts            # Database connection
│   ├── db-devices.ts    # Device operations
│   ├── db-telemetry.ts  # Telemetry operations
│   ├── db-alerts.ts     # Alert operations
│   ├── db-fallback.ts   # In-memory fallback
│   ├── socket-server.ts # Socket.IO server
│   └── simulation-engine.ts # Simulation logic
├── scripts/
│   ├── create-tables.sql # Database schema
│   ├── seed-data.sql     # Sample data
│   └── device-simulator.js # Standalone simulator
└── server.ts            # Custom server with Socket.IO
```

## 🧪 Testing

### Manual Testing

1. Start the application
2. Navigate to the dashboard
3. Click "Start Simulation" to begin generating telemetry data
4. Watch real-time updates on the map and dashboard
5. Check alerts panel for any triggered alerts

### Standalone Simulator

Run the standalone device simulator:

```bash
node scripts/device-simulator.js start
```

## 🚨 Troubleshooting

### Database Connection Issues

If you see database connection errors:

- Check that PostgreSQL is running
- Verify `DATABASE_URL` in `.env`
- The app will automatically use fallback mode if database is unavailable

### Socket.IO Not Working

- Ensure you're using `npm run dev` (not `npm run dev:next`)
- Check that port 3000 is not in use
- Verify `NEXT_PUBLIC_SOCKET_URL` in `.env`

### Port Already in Use

Change the port in `server.ts` or set `PORT` environment variable:

```bash
PORT=3001 npm run dev
```

## 🔮 Future Enhancements

- [ ] User authentication and authorization
- [ ] Geofencing with alerts
- [ ] Historical data analytics and reporting
- [ ] Mobile app for drivers
- [ ] Route optimization
- [ ] Predictive maintenance
- [ ] Email/SMS notifications
- [ ] Multi-tenant support

## 📝 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.
=======


🚛 Real-Time Fleet Monitoring System

A smart and intuitive dashboard to help businesses track, manage, and analyze their fleet activities — live and in real time.

Live Demo: [https://v0-real-time-fleet-monitoring.vercel.app](https://v0-real-time-fleet-monitoring.vercel.app)

---

What’s This Project About?

Managing a fleet is no easy job — and that's exactly what this app is here to solve.

This web-based fleet monitoring system helps businesses:
• Monitor live vehicle data
• Track vehicle status and routes
• Analyze fleet performance at a glance
• Make smarter decisions with real-time insights

---

Tech Stack Used

Here’s what powers this project:

• Framework: Next.js 14 (App Router)
• Language: TypeScript
• Styling: Tailwind CSS
• Backend: API Routes + PostgreSQL
• ORM: Prisma
• Package Manager: pnpm
• Hosting: Vercel

---

Folder Structure Overview

fleet-pulse
│
├── app → Application routing and layout
│   └── api → API endpoints
│   └── layout.tsx → Root layout file
│
├── components → Reusable UI components
├── hooks → Custom React hooks
├── lib → Utility functions
├── public → Static assets like images
├── scripts → SQL seed and setup scripts
├── styles → Global CSS
├── prisma → Database schema and seeding logic
├── .gitignore, package.json, tailwind.config.ts → Configuration files

---

How to Run It Locally

Step 1: Clone the repository
› git clone [https://github.com/Sohamiota/fleetpulse2.git](https://github.com/Sohamiota/fleetpulse2.git)
› cd fleetpulse2

Step 2: Install dependencies
› pnpm install

Step 3: Set up environment variables
› Create a `.env` file
› Add your database URL and any other required secrets

Step 4: Start the development server
› pnpm dev

---

Key Features

• Real-time vehicle status updates
• Route tracking and trip data
• Fast-loading, responsive user interface
• Clean and modular codebase
• Easily scalable for large-scale fleet operations

---

Coming Soon / Future Enhancements

• Live map tracking (Google Maps or Mapbox integration)
• Advanced performance analytics and charts
• Real-time alerts and notifications
• Admin dashboard for fleet managers

---

Author

Built with love by Sohamiota
GitHub: [https://github.com/Sohamiota](https://github.com/Sohamiota)

>>>>>>> e6abc97ae70c6793cd759085238882e0d79bb404
