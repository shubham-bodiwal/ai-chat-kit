import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Chat, controllableFetch } from "./helpers";

const assistant = () => screen.getAllByRole("article", { name: "Assistant" }).at(-1)!;

describe("streaming chat", () => {
  it("renders text as it streams, then settles with actions", async () => {
    const f = controllableFetch();
    const { container } = render(<Chat fetch={f.fetch} />);
    await userEvent.type(screen.getByLabelText("Message"), "Hello{Enter}");

    expect(screen.getByRole("article", { name: "You" })).toHaveTextContent("Hello");
    expect(f.calls[0].body.messages).toEqual([{ role: "user", content: "Hello" }]);
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.getByRole("log")).toHaveAttribute("aria-busy", "true");

    await act(async () => f.push({ type: "text", delta: "Hi " }));
    await waitFor(() => expect(assistant()).toHaveTextContent("Hi"));
    await act(async () => f.push({ type: "text", delta: "**there**" }));
    await waitFor(() => expect(within(assistant()).getByText("there").tagName).toBe("STRONG"));
    expect(container.querySelector(".ck-caret")).not.toBeNull();

    await act(async () => f.close());
    await waitFor(() => expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument());
    expect(container.querySelector(".ck-caret")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Hi there");
  });

  it("stop aborts the request, keeps partial text, and cancels pending tools", async () => {
    const f = controllableFetch();
    render(<Chat fetch={f.fetch} />);
    await userEvent.type(screen.getByLabelText("Message"), "Go{Enter}");
    await act(async () => {
      f.push({ type: "text", delta: "Partial" });
      f.push({ type: "tool-call", id: "t1", name: "search", args: { q: "x" } });
    });
    await waitFor(() => expect(screen.getByText("Running")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(f.calls[0].signal.aborted).toBe(true);
    await waitFor(() => expect(screen.getByText("Stopped", { selector: ".ck-note" })).toBeInTheDocument());
    expect(assistant()).toHaveTextContent("Partial");
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("Escape in the composer stops a running reply", async () => {
    const f = controllableFetch();
    render(<Chat fetch={f.fetch} />);
    const input = screen.getByLabelText("Message");
    await userEvent.type(input, "Go{Enter}");
    await userEvent.type(input, "{Escape}");
    expect(f.calls[0].signal.aborted).toBe(true);
  });

  it("Shift+Enter adds a newline instead of sending", async () => {
    const f = controllableFetch();
    render(<Chat fetch={f.fetch} />);
    const input = screen.getByLabelText("Message");
    await userEvent.type(input, "a{Shift>}{Enter}{/Shift}b");
    expect(input).toHaveValue("a\nb");
    expect(f.calls).toHaveLength(0);
  });

  it("shows a server error and retries the same question", async () => {
    const f = controllableFetch();
    render(<Chat fetch={f.fetch} />);
    await userEvent.type(screen.getByLabelText("Message"), "Q{Enter}");
    await act(async () => f.push({ type: "error", message: "Rate limited" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Rate limited");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1].body.messages).toEqual([{ role: "user", content: "Q" }]);
    expect(screen.getAllByRole("article", { name: "Assistant" })).toHaveLength(1);
  });

  it("regenerate replaces the last reply", async () => {
    const f = controllableFetch();
    render(<Chat fetch={f.fetch} />);
    await userEvent.type(screen.getByLabelText("Message"), "Q{Enter}");
    await act(async () => {
      f.push({ type: "text", delta: "First" });
      f.close();
    });
    await userEvent.click(await screen.findByRole("button", { name: "Regenerate" }));
    await act(async () => f.push({ type: "text", delta: "Second" }));
    await waitFor(() => expect(assistant()).toHaveTextContent("Second"));
    expect(screen.queryByText("First")).toBeNull();
  });
});
