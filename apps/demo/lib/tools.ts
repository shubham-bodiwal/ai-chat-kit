/** The one tool both modes share. Real data (the server clock), so the demo never invents numbers. */
export const timeTool = {
  type: "function" as const,
  function: {
    name: "get_current_time",
    description: "Get the current local time in an IANA timezone, e.g. Asia/Tokyo.",
    parameters: {
      type: "object",
      properties: { timezone: { type: "string", description: "IANA timezone name" } },
      required: ["timezone"],
    },
  },
};

export function getCurrentTime({ timezone }: { timezone?: string }) {
  if (!timezone) throw new Error("timezone is required");
  const now = new Date();
  // Throws RangeError for unknown zones; callers turn that into a tool-error event.
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", weekday: "long" }).format(now);
  return { timezone, time };
}

export function runTool(name: string, args: unknown) {
  if (name === "get_current_time") return getCurrentTime(args as { timezone?: string });
  throw new Error(`Unknown tool: ${name}`);
}
