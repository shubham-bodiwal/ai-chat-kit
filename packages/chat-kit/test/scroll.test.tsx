import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MessageList } from "../src";
import type { ChatMessage } from "../src";

const msgs = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(i), role: i % 2 ? "assistant" : "user", parts: [{ type: "text", text: `m${i}` }] }));

/** jsdom has no layout, so fake a 300px viewport over content that grows 100px per message. */
function fakeLayout(el: HTMLElement) {
  let top = 0;
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 300 });
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => el.querySelectorAll("article").length * 100 });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (v: number) => (top = Math.max(0, Math.min(v, el.scrollHeight - 300))),
  });
}

describe("auto-scroll", () => {
  it("follows new content while pinned to the bottom", () => {
    const { rerender } = render(<MessageList messages={msgs(4)} status="idle" />);
    const log = screen.getByRole("log");
    fakeLayout(log);
    rerender(<MessageList messages={msgs(6)} status="streaming" />);
    expect(log.scrollTop).toBe(300);
    rerender(<MessageList messages={msgs(8)} status="streaming" />);
    expect(log.scrollTop).toBe(500);
  });

  it("stops following once the user scrolls up, and offers a jump back", async () => {
    const { rerender } = render(<MessageList messages={msgs(6)} status="streaming" />);
    const log = screen.getByRole("log");
    fakeLayout(log);
    rerender(<MessageList messages={msgs(7)} status="streaming" />);
    expect(log.scrollTop).toBe(400);

    log.scrollTop = 50;
    fireEvent.scroll(log);
    rerender(<MessageList messages={msgs(9)} status="streaming" />);
    expect(log.scrollTop).toBe(50);

    await userEvent.click(screen.getByRole("button", { name: "Jump to latest" }));
    expect(log.scrollTop).toBe(600);
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
    rerender(<MessageList messages={msgs(10)} status="streaming" />);
    expect(log.scrollTop).toBe(700);
  });

  it("re-pins when the user scrolls back near the bottom", () => {
    const { rerender } = render(<MessageList messages={msgs(6)} status="streaming" />);
    const log = screen.getByRole("log");
    fakeLayout(log);
    log.scrollTop = 0;
    fireEvent.scroll(log);
    log.scrollTop = 280; // within the 48px threshold of 300
    fireEvent.scroll(log);
    rerender(<MessageList messages={msgs(8)} status="streaming" />);
    expect(log.scrollTop).toBe(500);
  });
});
