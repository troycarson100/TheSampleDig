"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none w-full"
const btnCls = "rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-75 disabled:opacity-40 cursor-pointer mt-3"
const fieldStyle = {
  borderColor: "var(--border)",
  color: "var(--foreground)",
  background: "rgba(255, 255, 255, 0.45)",
}
const primaryBtnStyle = { borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }

export default function RedeemForm() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/comps/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Redeem failed")
      router.push("/products")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redeem failed")
      setBusy(false)
    }
  }

  return (
    <div>
      <input
        className={inputCls}
        style={fieldStyle}
        placeholder="GIFT-XXXX-XXXX-XXXX"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy) submit()
        }}
      />
      {error ? (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <button className={btnCls} style={primaryBtnStyle} disabled={busy || !code.trim()} onClick={submit}>
        {busy ? "Redeeming..." : "Redeem"}
      </button>
    </div>
  )
}
