/**
 * Loads .env.local ahead of .env for scripts that need BOTH — DATABASE_URL lives
 * in .env, while local-only secrets like LICENSE_SIGNING_PRIVATE_KEY live in
 * .env.local. `-r dotenv/config` reads .env alone and silently misses the latter.
 *
 * Import this FIRST, before anything that reads process.env at module scope
 * (lib/db constructs PrismaClient on import). ESM evaluates imports in order,
 * so the position of the import statement is load-bearing.
 */
import { config } from "dotenv"

// Earlier paths win; dotenv does not overwrite an already-set variable.
config({ path: [".env.local", ".env"] })
