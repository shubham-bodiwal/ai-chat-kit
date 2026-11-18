import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatStatus } from "./types";

export interface ComposerProps {
  status: ChatStatus;
  onSend: (text: string) => void;
  onStop: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Enter sends, Shift+Enter adds a line, Escape stops a running reply. */
export function Composer({ status, onSend, onStop, placeholder = "Ask anything", autoFocus }: ComposerProps) {
  const [value, setValue] = useState("");
  const streaming = status === "streaming";

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (streaming || !value.trim()) return;
    onSend(value);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
    else if (e.key === "Escape" && streaming) onStop();
  };

  return (
    <form className="ck-composer" onSubmit={submit}>
      <label htmlFor="ck-input" className="ck-sr-only">
        Message
      </label>
      <textarea
        id="ck-input"
        rows={1}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        aria-describedby="ck-hint"
      />
      <span id="ck-hint" className="ck-sr-only">
        Enter to send, Shift Enter for a new line, Escape to stop.
      </span>
      {streaming ? (
        <button type="button" className="ck-btn ck-btn--primary" onClick={onStop}>
          Stop
        </button>
      ) : (
        <button type="submit" className="ck-btn ck-btn--primary" disabled={!value.trim()}>
          Send
        </button>
      )}
    </form>
  );
}
