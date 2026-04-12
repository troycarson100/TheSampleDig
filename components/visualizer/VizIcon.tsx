"use client"

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type SVGProps,
} from "react"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { vizCn } from "./viz-cn"

/**
 * Lucide-style icon: `forwardRef` SVG component. Works with `lucide-react` icons once that
 * package is installed (`npm install lucide-react`).
 */
export type VizIconComponent = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>
>

type IconComponentProps = ComponentPropsWithoutRef<VizIconComponent>

export interface VizIconProps extends Omit<IconComponentProps, "ref" | "color"> {
  icon: VizIconComponent
}

export const VizIcon = forwardRef<SVGSVGElement, VizIconProps>(function VizIcon(
  { icon: Icon, className, strokeWidth = 1.75, style, ...rest },
  ref
) {
  return (
    <Icon
      ref={ref}
      {...rest}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={vizCn("text-[#C9A94E]", className)}
      style={{ color: VIZ_COLORS.gold, ...style }}
    />
  )
})
