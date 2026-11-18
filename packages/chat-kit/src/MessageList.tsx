import { useEffect, useState, type ReactNode } from "react";
import { Markdown } from "./Markdown";
import { ToolCallCard } from "./ToolCallCard";
import { useAutoScroll } from "./useAutoScroll";
import { messageText } from "./useChat";
import type { ChatMessage, ChatStatus, ToolCall } from "./types";

export interface MessageListProps {
  messages: ChatMessage[];
  status: ChatStatus;
  error?: string | null;
  onRegenerate?: () => void;
  /** Override how a tool call renders (e.g. a weather widget for `get_weather`). */
  renderToolCall?: (call: ToolCall) => ReactNode;
  /** Shown when there are no messages. */
  empty?: ReactNode;
  className?: string;
}

const statusText: Record<ChatStatus, string> = {
  idle: "",
  streaming: "Assistant is responding",
  stopped: "Response stopped",
  error: "Response failed",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ck-btn ck-btn--ghost"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }, () => {})
      }
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function MessageList({ messages, status, error, onRegenerate, renderToolCall, empty, className }: MessageListProps) {
  const { ref, atBottom, onScroll, scrollToBottom } = useAutoScroll<HTMLDivElement>(messages);
  const streaming = status === "streaming";
  const last = messages[messages.length - 1];

  // Screen readers get one announcement per reply instead of one per token.
  const [announce, setAnnounce] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: announce only when the status changes, not on every token
  useEffect(() => {
    if (status === "idle" && last?.role === "assistant") {
      // Rendered text, not raw markdown, so "**bold**" isn't read out as asterisks.
      const body = ref.current?.querySelector("article:last-of-type .ck-msg__body");
      setAnnounce((body?.textContent ?? messageText(last)).slice(0, 500));
    } else setAnnounce(statusText[status]);
  }, [status]);

  return (
    <div className={["ck-thread", className].filter(Boolean).join(" ")}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="ck-scroll"
        role="log"
        aria-live="off"
        aria-busy={streaming}
        aria-label="Conversation"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable log must be keyboard-reachable
        tabIndex={0}
      >
        {messages.length === 0 && empty}
        {messages.map((m) => {
          const isLast = m === last;
          return (
            <article key={m.id} className="ck-msg" data-role={m.role} aria-label={m.role === "user" ? "You" : "Assistant"}>
              <div className="ck-msg__body">
                {m.role === "assistant" && m.parts.length === 0 && isLast && streaming && (
                  <span className="ck-thinking" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                {m.parts.map((p, i) =>
                  p.type === "text" ? (
                    m.role === "user" ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only, so the index is stable
                      <p key={i} className="ck-user-text">
                        {p.text}
                      </p>
                    ) : (
                      // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only, so the index is stable
                      <Markdown key={i}>{p.text}</Markdown>
                    )
                  ) : (
                    <div key={p.call.id}>{renderToolCall?.(p.call) ?? <ToolCallCard call={p.call} />}</div>
                  ),
                )}
                {m.role === "assistant" && isLast && streaming && m.parts.length > 0 && (
                  <span className="ck-caret" aria-hidden="true" />
                )}
              </div>
              {m.role === "assistant" && isLast && !streaming && (
                <div className="ck-msg__actions">
                  {status === "stopped" && <span className="ck-note">Stopped</span>}
                  {status === "error" && (
                    <span className="ck-note ck-note--error" role="alert">
                      {error ?? "Something went wrong"}
                    </span>
                  )}
                  {messageText(m) && <CopyButton text={messageText(m)} />}
                  {onRegenerate && (
                    <button type="button" className="ck-btn ck-btn--ghost" onClick={onRegenerate}>
                      {status === "error" ? "Retry" : "Regenerate"}
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!atBottom && (
        <button type="button" className="ck-btn ck-jump" onClick={scrollToBottom}>
          Jump to latest
        </button>
      )}
      <div className="ck-sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
