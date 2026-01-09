export const tokens = {
  // Core palette: warm neutrals + one accent (amber/orange)
  color: {
    bg: "#FAF7F2", // warm off-white
    surface: "#FFFFFF",
    surface2: "#FFF7ED", // subtle tinted surface
    text: "#171717",
    text2: "#525252",
    border: "rgba(0,0,0,0.08)",

    // Accent
    accent: "#F59E0B", // amber-500
    accent2: "#FB923C", // orange-400
    accentText: "#FFFFFF",

    // States
    danger: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B",
  },

  radius: {
    sm: "10px",
    md: "14px",
    lg: "20px",
    xl: "28px",
  },

  shadow: {
    sm: "0 6px 16px rgba(0,0,0,0.08)",
    md: "0 14px 40px rgba(0,0,0,0.10)",
    glow: "0 0 0 6px rgba(245, 158, 11, 0.12)",
  },

  // Layout
  layout: {
    container: "1120px",
    gutter: "24px",
    heroMaxText: "640px",
  },

  // Typography (match a premium SaaS feel)
  font: {
    sans: 'ui-sans-serif, system-ui, -apple-system, "SF Pro Display", "Inter", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
} as const;

