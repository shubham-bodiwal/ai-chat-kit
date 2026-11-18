import { useCallback, useRef, useState } from "react";
import type { ChatMessage, ChatStatus, MessagePart, StreamEvent } from "./types";

export interface UseChatOptions {
  /** Endpoint that accepts `{ messages: { role, content }[] }` and streams NDJSON `StreamEvent`s. */
  api: string;
  initialMessages?: ChatMessage[];
  /** Extra JSON merged into every request body. */
  body?: Record<string, unknown>;
  fetch?: typeof fetch;
}

let counter = 0;
const uid = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

export const messageText = (m: ChatMessage) =>
  m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

/** Pure: returns a new parts array with one stream event applied. */
export function applyEvent(parts: MessagePart[], e: StreamEvent): MessagePart[] {
  switch (e.type) {
    case "text": {
      const last = parts[parts.length - 1];
      if (last?.type === "text") return [...parts.slice(0, -1), { type: "text", text: last.text + e.delta }];
      return [...parts, { type: "text", text: e.delta }];
    }
    case "tool-call":
      return [...parts, { type: "tool", call: { id: e.id, name: e.name, args: e.args, state: "pending" } }];
    case "tool-result":
    case "tool-error":
      return parts.map((p) =>
        p.type === "tool" && p.call.id === e.id
          ? {
              type: "tool",
              call:
                e.type === "tool-result"
                  ? { ...p.call, state: "result", result: e.result }
                  : { ...p.call, state: "error", error: e.error },
            }
          : p,
      );
    default:
      return parts;
  }
}

const cancelPending = (parts: MessagePart[], reason: string): MessagePart[] =>
  parts.map((p) =>
    p.type === "tool" && p.call.state === "pending" ? { type: "tool", call: { ...p.call, state: "error", error: reason } } : p,
  );

export function useChat({ api, initialMessages = [], body, fetch: fetchImpl }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Mirror of `messages` so callbacks never read a stale closure.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const run = useCallback(
    async (history: ChatMessage[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const assistantId = uid();
      const update = (fn: (parts: MessagePart[]) => MessagePart[]) =>
        setMessages((ms) => ms.map((m) => (m.id === assistantId ? { ...m, parts: fn(m.parts) } : m)));

      setMessages([...history, { id: assistantId, role: "assistant", parts: [] }]);
      setStatus("streaming");
      setError(null);

      try {
        const res = await (fetchImpl ?? fetch)(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            messages: history.map((m) => ({ role: m.role, content: messageText(m) })),
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as StreamEvent;
            if (event.type === "error") throw new Error(event.message);
            update((parts) => applyEvent(parts, event));
          }
        }
        if (abortRef.current === controller) setStatus("idle");
      } catch (err) {
        if (controller.signal.aborted) {
          update((parts) => cancelPending(parts, "Stopped"));
          if (abortRef.current === controller) setStatus("stopped");
          return;
        }
        update((parts) => cancelPending(parts, "Interrupted"));
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [api, body, fetchImpl],
  );

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content) return;
      return run([...messagesRef.current, { id: uid(), role: "user", parts: [{ type: "text", text: content }] }]);
    },
    [run],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Drops the last assistant reply (finished, stopped or failed) and asks again. */
  const regenerate = useCallback(() => {
    const ms = messagesRef.current;
    const history = ms[ms.length - 1]?.role === "assistant" ? ms.slice(0, -1) : ms;
    if (history.length) return run(history);
  }, [run]);

  return { messages, status, error, send, stop, regenerate, setMessages };
}
