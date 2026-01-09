export function FloatingExampleCard({
  src,
  className = "",
  label,
}: {
  src: string;
  label?: string;
  className?: string;
}) {
  return (
    <div
      class={
        "relative rounded-xl bg-surface border border-white/70 shadow-md overflow-hidden " +
        "ring-1 ring-black/5 " +
        className
      }
    >
      <img src={src} class="block w-full h-full object-cover" />
      {label ? (
        <div class="absolute bottom-2 left-2 rounded-md bg-white/85 px-2 py-1 text-xs text-text2 shadow-sm">
          {label}
        </div>
      ) : null}
    </div>
  );
}
