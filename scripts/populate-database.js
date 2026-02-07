/**
 * Background job script to pre-populate the database
 * Run this via cron or scheduled task (e.g., nightly)
 * 
 * Usage:
 *   node scripts/populate-database.js [limit] [secret]
 * 
 * Example:
 *   node scripts/populate-database.js 500 my-secret-key
 */

const POPULATE_SECRET = process.env.POPULATE_SECRET || "change-me-in-production"
const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

async function populateDatabase(limit = 100) {
  const url = `${BASE_URL}/api/samples/populate?secret=${POPULATE_SECRET}&limit=${limit}`
  
  console.log(`[Populate Script] Starting pre-population...`)
  console.log(`[Populate Script] URL: ${BASE_URL}/api/samples/populate`)
  console.log(`[Populate Script] Limit: ${limit} samples`)
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HTTP ${response.status}: ${error}`)
    }
    
    const result = await response.json()
    console.log(`[Populate Script] ✓ Success!`)
    console.log(`[Populate Script] Stats:`, result.stats)
    console.log(`[Populate Script] Message: ${result.message}`)
    
    return result
  } catch (error) {
    console.error(`[Populate Script] ✗ Error:`, error.message)
    process.exit(1)
  }
}

// Get command line arguments
const limit = parseInt(process.argv[2] || "100", 10)
const secret = process.argv[3] || POPULATE_SECRET

// Override secret if provided
if (process.argv[3]) {
  process.env.POPULATE_SECRET = secret
}

// Run the population
populateDatabase(limit)
  .then(() => {
    console.log(`[Populate Script] Done!`)
    process.exit(0)
  })
  .catch((error) => {
    console.error(`[Populate Script] Fatal error:`, error)
    process.exit(1)
  })
