"use client"

import { forwardRef } from "react"
import { VIZ_COLORS } from "@/lib/visualizer/constants/design-tokens"
import { vizCn } from "./viz-cn"

export interface VizPanelProps extends React.ComponentPropsWithoutRef<"div"> {
  title?: string
  /** Slot below the optional title bar; same as children if no title */
  bodyClassName?: string
}

export const VizPanel = forwardRef<HTMLDivElement, VizPanelProps>(function VizPanel(
  { className, title, children, bodyClassName, style, ...rest },
  ref
) {
  const panelStyle: React.CSSProperties = {
    backgroundColor: VIZ_COLORS.bgPanel,
    borderColor: VIZ_COLORS.border,
    ...style,
  }

  return (
    <div
      ref={ref}
      className={vizCn("overflow-hidden rounded-lg border", className)}
      style={panelStyle}
      {...rest}
    >
      {title !== undefined && title !== "" ? (
        <>
          <div
            className="border-b px-3 py-2"
            style={{
              borderColor: VIZ_COLORS.border,
              color: VIZ_COLORS.goldLight,
            }}
          >
            <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
          </div>
          <div className={vizCn("p-3", bodyClassName)}>{children}</div>
        </>
      ) : (
        <div className={vizCn("p-3", bodyClassName)}>{children}</div>
      )}
    </div>
  )
})
