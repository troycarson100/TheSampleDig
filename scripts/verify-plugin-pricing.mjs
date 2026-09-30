#!/usr/bin/env node
// Guards the pricing invariants from the redesign spec:
//   - no crossgrade identifier survives outside docs/
//   - no price literal is typed into a component or metadata
import { execFileSync } from "node:child_process"

const failures = []
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok   ${label}`)
  else { console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failures.push(label) }
}

function grep(pattern) {
  try {
    return execFileSync("grep", ["-rn", "-E", pattern, "app", "components", "lib",
      "--include=*.ts", "--include=*.tsx"], { encoding: "utf8" }).trim().split("\n").filter(Boolean)
  } catch { return [] }  // grep exits 1 when there are no matches
}

const cross = grep("crossgrade|Crossgrade|CROSSGRADE")
check("no crossgrade identifiers remain", cross.length === 0, cross.slice(0, 5).join(" | "))

// 19 and 59 were fltr's intro price and the bundle's, until 2026-09-30.
const literals = grep("\\$(19|34|15|39|59)\\b")
check("no stale price literals remain", literals.length === 0, literals.slice(0, 5).join(" | "))

const { PRICING } = await import("../lib/products.ts")
check("shft is $29 / $49", PRICING.shft.price === 29 && PRICING.shft.msrp === 49)
check("drft is $29 / $49", PRICING.drft.price === 29 && PRICING.drft.msrp === 49)
check("fltr is $29 / $49", PRICING.fltr.price === 29 && PRICING.fltr.msrp === 49)
check("bundle is $69 / $147", PRICING.bundle.price === 69 && PRICING.bundle.compareAt === 147)
check("crossgrade is gone from PRICING", !("crossgrade" in PRICING))

process.exit(failures.length ? 1 : 0)
