/** Join Tailwind / conditional classes for visualizer UI */
export function vizCn(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join(" ")
}
