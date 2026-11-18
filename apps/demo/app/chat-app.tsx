"use client";

import { Composer, MessageList, useChat } from "@ai-chat-kit/react";
import { Clock, CodeBlock, Moon, Sun, WarningCircle } from "@phosphor-icons/react";

const prompts = [
  { icon: CodeBlock, text: "Show me how to stream NDJSON with fetch" },
  { icon: Clock, text: "What time is it in Tokyo?" },
  { icon: WarningCircle, text: "Call a tool that fails" },
];

/** The icon is picked in CSS, so it is right before hydration and follows system changes. */
function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: theme just won't persist */
    }
  };
  return (
    <button type="button" className="icon-btn theme-btn" onClick={toggle} aria-label="Toggle light and dark theme">
      <Moon size={18} className="when-light" />
      <Sun size={18} className="when-dark" />
    </button>
  );
}

export function ChatApp({ mode }: { mode: string | null }) {
  const chat = useChat({ api: "/api/chat" });

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">ai-chat-kit</span>
        <span className="mode" title={mode ? "Streaming from your OpenAI-compatible endpoint" : "No API key set: scripted stream"}>
          {mode ? `Live: ${mode}` : "Demo mode"}
        </span>
        <div className="topbar__end">
          {chat.messages.length > 0 && (
            <button type="button" className="text-btn" onClick={() => (chat.stop(), chat.setMessages([]))}>
              New chat
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="main">
        <MessageList
          messages={chat.messages}
          status={chat.status}
          error={chat.error}
          onRegenerate={chat.regenerate}
          empty={
            <section className="intro">
              <h1>Streaming chat, without the rough edges.</h1>
              <p>Markdown, tool calls, stop and retry, and scrolling that stays put when you read back.</p>
              <ul className="prompts">
                {prompts.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <button type="button" onClick={() => chat.send(text)}>
                      <Icon size={18} aria-hidden="true" />
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          }
        />
        <div className="dock">
          <Composer status={chat.status} onSend={chat.send} onStop={chat.stop} autoFocus />
          <p className="hint">
            <span><kbd>Enter</kbd> send</span>
            <span><kbd>Shift</kbd> + <kbd>Enter</kbd> new line</span>
            <span><kbd>Esc</kbd> stop</span>
          </p>
        </div>
      </main>
    </div>
  );
}
