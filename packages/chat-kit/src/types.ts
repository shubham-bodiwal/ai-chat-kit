export type ToolCallState = "pending" | "result" | "error";

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  state: ToolCallState;
  result?: unknown;
  error?: string;
}

/** A message is an ordered list of parts so tool calls render where they happened. */
export type MessagePart =
  | { type: "text"; text: string }
  | { type: "tool"; call: ToolCall };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

export type ChatStatus = "idle" | "streaming" | "stopped" | "error";

/** Wire format: one JSON object per line (NDJSON) in the response body. */
export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool-call"; id: string; name: string; args: unknown }
  | { type: "tool-result"; id: string; result: unknown }
  | { type: "tool-error"; id: string; error: string }
  | { type: "error"; message: string };
