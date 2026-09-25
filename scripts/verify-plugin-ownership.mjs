#!/usr/bin/env node
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

const res = await fetch(`${BASE}/api/plugins/ownership`)
check("endpoint responds 200", res.status === 200, `got ${res.status}`)
const body = await res.json().catch(() => null)
check("reports signedIn", body && typeof body.signedIn === "boolean")
check("reports all three products", body?.owned &&
  ["shft", "drft", "fltr"].every((id) => typeof body.owned[id] === "boolean"),
  JSON.stringify(body?.owned))
check("signed-out visitor owns nothing",
  body?.signedIn === false && Object.values(body.owned).every((v) => v === false))

process.exit(failures.length ? 1 : 0)
