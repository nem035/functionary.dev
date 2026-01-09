type Props = {
  variant?: "primary" | "secondary";
  className?: string;
  [key: string]: any;
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition " +
    "focus:outline-none focus-visible:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed";

  const styles =
    variant === "primary"
      ? "text-white bg-gradient-to-r from-accent to-accent2 shadow-sm hover:shadow-md hover:-translate-y-[1px]"
      : "bg-surface border border-border text-text hover:-translate-y-[1px]";

  return <button class={`${base} ${styles} ${className}`} {...props} />;
}
