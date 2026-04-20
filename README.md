
---
# FleetPulse

> Real-time IoT Fleet Monitoring System

A comprehensive full-stack fleet monitoring system built with Next.js, PostgreSQL, and Socket.IO for real-time telemetry tracking, alerting, and analytics.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5%2B-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-336791)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🚀 Features

- ✅ **Real-time Monitoring** — Live tracking of fleet vehicles with WebSocket updates
- ✅ **Interactive Map** — Visual fleet map showing device locations and status
- ✅ **Alert System** — Automated alerts for speed violations, temperature warnings, and fuel levels
- ✅ **Telemetry Analytics** — Historical data visualization with charts and graphs
- ✅ **Simulation Engine** — Realistic vehicle simulation with traffic patterns and fuel consumption
- ✅ **Database Integration** — PostgreSQL with PostGIS for geospatial queries
- ✅ **WebSocket Support** — Real-time communication via Socket.IO
- ✅ **Fallback Mode** — Works without database for demo purposes

---

## 📋 Prerequisites

- **Node.js** 18+ and npm/pnpm
- **PostgreSQL** 14+ with PostGIS extension *(optional — fallback mode available)*
- **TypeScript** 5+

---

## 🛠️ Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/Aditi1989/fleetpulse.git
cd fleetpulse
```

### Step 2: Install Dependencies

```bash
npm install
# or
pnpm install
```

### Step 3: Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/fleetpulse
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NODE_ENV=development
```

### Step 4: Set Up Database *(Optional)*

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

> **Note:** The app will work in fallback mode without a database for demo purposes.

---

## 🏃 Running the Application

### Development Mode (Recommended)

With Socket.IO server enabled:

```bash
npm run dev
```

### Standard Next.js Development

Without Socket.IO:

```bash
npm run dev:next
```

### Production Mode

```bash
npm run build
npm run start
```

The application will be available at **`http://localhost:3000`**

To use a different port:

```bash
PORT=3001 npm run dev
```

---

## 📊 Database Schema

| Table | Description |
|-------|-------------|
| **devices** | Device information (id, name, type, status) |
| **telemetry** | Time-series telemetry data (location, speed, temperature, fuel, humidity) |
| **alerts** | Alert records with severity levels |
| **geofences** | Geofence definitions (reserved for future use) |

See `scripts/create-tables.sql` for the complete schema.

---

## 🔌 API Endpoints

### Devices

```
GET    /api/devices              # Get all devices
POST   /api/devices              # Create/update a device
```

### Telemetry

```
POST   /api/telemetry            # Submit telemetry data
GET    /api/telemetry            # Get telemetry history
       ?deviceId=xxx&limit=100
```

### Simulation

```
POST   /api/simulation            # Start/stop simulation
       Body: {action: "start"|"stop"}
GET    /api/simulation            # Get simulation status
```

### Alerts

```
GET    /api/alerts               # Get alerts
       ?deviceId=xxx&isActive=true&limit=100
POST   /api/alerts               # Resolve an alert
       Body: {action: "resolve", alertId: "123"}
```

---

## 🎮 Simulation Features

The simulation engine provides realistic telemetry without needing real hardware:

- **Route-based Movement** — Different patterns: highway, downtown, residential, industrial, suburban
- **Realistic Metrics** — Speed, temperature, fuel consumption based on route type
- **Traffic Simulation** — Random traffic jams and clear road conditions
- **Fuel Consumption** — Realistic consumption based on speed and route
- **Auto-refueling** — Automatic refueling when fuel is critically low

### Running the Standalone Simulator

```bash
node scripts/device-simulator.js start
```

---

## 📁 Project Structure

```
fleet-pulse/
├── app/
│   ├── api/
│   │   ├── devices/              # Device management endpoints
│   │   ├── telemetry/            # Telemetry ingestion & history
│   │   ├── simulation/           # Simulation control
│   │   └── alerts/               # Alert management
│   ├── page.tsx                  # Main dashboard
│   └── layout.tsx                # Root layout
│
├── components/
│   ├── fleet-map.tsx             # Live map visualization
│   ├── device-card.tsx           # Device status cards
│   ├── alert-panel.tsx           # Active alerts display
│   └── telemetry-chart.tsx       # Historical charts
│
├── lib/
│   ├── db.ts                     # Database connection
│   ├── db-devices.ts             # Device DB operations
│   ├── db-telemetry.ts           # Telemetry DB operations
│   ├── db-alerts.ts              # Alert DB operations
│   ├── db-fallback.ts            # In-memory fallback store
│   ├── socket-server.ts          # Socket.IO server setup
│   └── simulation-engine.ts      # Vehicle simulation logic
│
├── scripts/
│   ├── create-tables.sql         # Database schema
│   ├── seed-data.sql             # Sample data
│   └── device-simulator.js       # Standalone CLI simulator
│
├── server.ts                      # Custom Node.js + Socket.IO server
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🔧 Configuration

### Alert Thresholds

Edit `app/api/telemetry/route.ts`:

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

---

## 🧪 Testing

### Manual Testing

1. Start the application (`npm run dev`)
2. Navigate to the dashboard at `http://localhost:3001`
3. Click **"Start Simulation"** to generate telemetry data
4. Watch real-time updates on the map and dashboard
5. Check the alerts panel for triggered alerts

### Standalone Simulator Testing

```bash
node scripts/device-simulator.js start
```

---

## 🚨 Troubleshooting

### Database Connection Issues

**Problem:** Database connection errors  
**Solution:**
- Ensure PostgreSQL is running
- Verify `DATABASE_URL` in `.env`
- The app will automatically fall back to in-memory mode if the database is unavailable

### Socket.IO Not Working

**Problem:** WebSocket connection fails  
**Solution:**
- Use `npm run dev` (not `npm run dev:next`)
- Ensure port 3000 is not in use
- Verify `NEXT_PUBLIC_SOCKET_URL` in `.env`

### Port Already in Use

**Problem:** Cannot bind to port 3000  
**Solution:**
- Set a different port via environment variable:
  ```bash
  PORT=3001 npm run dev
  ```
- Or edit the port directly in `server.ts`

---

## 🔮 Future Enhancements

- [ ] User authentication and authorization
- [ ] Geofencing with boundary alerts
- [ ] Historical data analytics and reporting
- [ ] Mobile app for drivers
- [ ] Route optimization engine
- [ ] Predictive maintenance analytics
- [ ] Email/SMS notifications
- [ ] Multi-tenant support

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5+ |
| **Styling** | Tailwind CSS |
| **Database** | PostgreSQL 14+ with PostGIS |
| **Real-time** | Socket.IO |
| **Server** | Custom Node.js (`server.ts`) |
| **Package Manager** | npm / pnpm |

### Important Notes

⚠️ This project uses a **custom Socket.IO server** (`server.ts`) — it does **not** deploy to Vercel's serverless environment.

⚠️ This project uses **raw PostgreSQL queries** — it does **not** use Prisma ORM.

---

## 📝 License

This project is licensed under the MIT License — see the LICENSE file for details.

---

## 👨‍💻 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 Support

For questions or issues, please open a GitHub Issue.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Real-time communication via [Socket.IO](https://socket.io/)
- Geospatial features powered by [PostGIS](https://postgis.net/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)




```

---

