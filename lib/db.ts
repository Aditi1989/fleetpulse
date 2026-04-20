import { Pool, PoolClient } from "pg"

// Database connection pool
let pool: Pool | null = null
let useFallback = false

// Check if database is available
async function checkDatabaseAvailability(): Promise<boolean> {
  try {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      return false
    }

    const testPool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 2000,
    })

    await testPool.query("SELECT NOW()")
    await testPool.end()
    return true
  } catch (error) {
    console.warn("Database not available, using in-memory fallback:", error)
    return false
  }
}

// Initialize database connection pool
export async function getPool(): Promise<Pool | null> {
  if (pool) {
    return pool
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.warn("DATABASE_URL not set, using in-memory fallback")
    useFallback = true
    return null
  }

  // Check if database is available
  const isAvailable = await checkDatabaseAvailability()
  if (!isAvailable) {
    useFallback = true
    return null
  }

  pool = new Pool({
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX || "20", 10),
    min: parseInt(process.env.DB_POOL_MIN || "5", 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
  // Handle pool errors
  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err)
    useFallback = true
  })

  return pool
}

// Check if using fallback mode
export function isUsingFallback(): boolean {
  return useFallback
}

// Execute a query with automatic connection management
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = await getPool()
  
  if (!pool) {
    // Return empty result if using fallback
    return { rows: [], rowCount: 0 }
  }

  const start = Date.now()
  
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    
    if (process.env.NODE_ENV === "development") {
      console.log("Executed query", { text, duration, rows: result.rowCount })
    }
    
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }
  } catch (error) {
    console.error("Database query error", { text, error })
    throw error
  }
}

// Get a client from the pool for transactions
export async function getClient(): Promise<PoolClient | null> {
  const pool = await getPool()
  if (!pool) {
    return null
  }
  return await pool.connect()
}

// Close the database connection pool
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    await query("SELECT NOW()")
    return true
  } catch (error) {
    console.error("Database connection test failed:", error)
    return false
  }
}

