import { ReactNode } from "react"

interface FeatureGateProps {
  children: ReactNode
  fallback?: ReactNode
}

const MARKETPLACE_ENABLED = process.env.NEXT_PUBLIC_MARKETPLACE_ENABLED === "true"

export default function FeatureGate({ children, fallback = null }: FeatureGateProps) {
  return <>{MARKETPLACE_ENABLED ? children : fallback}</>
}
