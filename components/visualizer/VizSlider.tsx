"use client"

import { forwardRef } from "react"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { vizCn } from "./viz-cn"

export interface VizSliderProps extends Omit<React.ComponentPropsWithoutRef<"input">, "type"> {}

export const VizSlider = forwardRef<HTMLInputElement, VizSliderProps>(function VizSlider(
  { className, style, disabled, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      type="range"
      disabled={disabled}
      className={vizCn(
        "h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-40",
        // Track
        "bg-[#3D2E18]",
        // Thumb (accent + WebKit / Firefox)
        "accent-[#C9A94E]",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5",
        "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border",
        "[&::-webkit-slider-thumb]:border-[#C9A94E] [&::-webkit-slider-thumb]:bg-[#E8D5A0] [&::-webkit-slider-thumb]:shadow-sm",
        "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer",
        "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#E8D5A0]",
        className
      )}
      style={{ accentColor: VIZ_COLORS.gold, ...style }}
      {...rest}
    />
  )
})
