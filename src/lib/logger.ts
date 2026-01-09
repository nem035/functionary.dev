export function makeLogger(requestId: string) {
  return (level: "info" | "error" | "warn" | "debug", msg: string, data: Record<string, unknown> = {}) => {
    const rec = { level, requestId, msg, ...data };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(rec));
  };
}

