export function FeatureRow() {
  const items = [
    { icon: "⚡", title: "Fast", desc: "Images in seconds, videos in minutes." },
    { icon: "🧩", title: "On-brand", desc: "Presets that look premium, not fake." },
    { icon: "💸", title: "No shoots", desc: "Skip studios and expensive reshoots." },
  ];

  return (
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {items.map((it) => (
        <div class="flex gap-3 items-start">
          <div class="h-10 w-10 rounded-lg bg-surface2 flex items-center justify-center text-text2">
            <span>{it.icon}</span>
          </div>
          <div>
            <div class="font-medium">{it.title}</div>
            <div class="text-sm text-text2">{it.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
