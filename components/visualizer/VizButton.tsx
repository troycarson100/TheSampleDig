"use client"

import { forwardRef } from "react"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { vizCn } from "./viz-cn"

export type VizButtonVariant = "outline" | "filled"

export interface VizButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: VizButtonVariant
}

export const VizButton = forwardRef<HTMLButtonElement, VizButtonProps>(function VizButton(
  { className, variant = "outline", disabled, type = "button", style, ...rest },
  ref
) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A94E] disabled:pointer-events-none disabled:opacity-40"

  const variants: Record<VizButtonVariant, string> = {
    outline: vizCn("border bg-transparent hover:bg-[#C9A94E]/10"),
    filled: "border border-transparent text-[#1A1209] hover:opacity-90",
  }

  const outlineStyle: React.CSSProperties = {
    borderColor: VIZ_COLORS.border,
    color: VIZ_COLORS.gold,
    ...style,
  }

  const filledStyle: React.CSSProperties = {
    backgroundColor: VIZ_COLORS.gold,
    color: VIZ_COLORS.bg,
    ...style,
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={vizCn(base, variants[variant], className)}
      style={variant === "filled" ? filledStyle : outlineStyle}
      {...rest}
    />
  )
})
