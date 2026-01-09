export function Card({ children, className = "" }: { children: any; className?: string }) {
  return <div class={`rounded-xl bg-surface border border-border shadow-sm ${className}`}>{children}</div>;
}
