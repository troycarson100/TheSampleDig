"use client"

import { forwardRef } from "react"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { vizCn } from "./viz-cn"

export interface VizSelectProps extends React.ComponentPropsWithoutRef<"select"> {}

export const VizSelect = forwardRef<HTMLSelectElement, VizSelectProps>(function VizSelect(
  { className, style, disabled, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      disabled={disabled}
      className={vizCn(
        "w-full cursor-pointer appearance-none rounded-md border px-3 py-2 pr-9 text-sm shadow-inner",
        "bg-[length:1rem_1rem] bg-[right_0.5rem_center] bg-no-repeat",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      style={{
        backgroundColor: VIZ_COLORS.bgPanel,
        borderColor: VIZ_COLORS.border,
        color: VIZ_COLORS.cream,
        outlineColor: VIZ_COLORS.gold,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23C9A94E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  )
})
