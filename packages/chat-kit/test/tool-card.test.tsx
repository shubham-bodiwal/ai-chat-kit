import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToolCallCard } from "../src";
import { Chat, controllableFetch } from "./helpers";

describe("ToolCallCard", () => {
  it("pending: shows the name and running state, collapsed", () => {
    const { container } = render(<ToolCallCard call={{ id: "1", name: "get_time", args: { tz: "UTC" }, state: "pending" }} />);
    expect(screen.getByText("get_time")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(container.querySelector("details")).toHaveAttribute("data-state", "pending");
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("result: shows arguments and result", () => {
    render(<ToolCallCard call={{ id: "1", name: "get_time", args: { tz: "UTC" }, state: "result", result: { time: "09:41" } }} />);
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText(/"time": "09:41"/)).toBeInTheDocument();
  });

  it("error: opens itself and announces the error", () => {
    const { container } = render(<ToolCallCard call={{ id: "1", name: "get_time", args: {}, state: "error", error: "Timed out" }} />);
    expect(container.querySelector("details")).toHaveAttribute("open");
    expect(screen.getByRole("alert")).toHaveTextContent("Timed out");
  });

  it("moves pending -> result as stream events arrive, inline with text", async () => {
    const f = controllableFetch();
    render(<Chat fetch={f.fetch} />);
    await userEvent.type(screen.getByLabelText("Message"), "time?{Enter}");
    await act(async () => {
      f.push({ type: "text", delta: "Checking." });
      f.push({ type: "tool-call", id: "t1", name: "get_time", args: {} });
    });
    await waitFor(() => expect(screen.getByText("Running")).toBeInTheDocument());
    await act(async () => {
      f.push({ type: "tool-result", id: "t1", result: "09:41" });
      f.push({ type: "text", delta: "It is 09:41." });
      f.close();
    });
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    const body = screen.getByRole("article", { name: "Assistant" }).textContent!;
    expect(body.indexOf("Checking.")).toBeLessThan(body.indexOf("get_time"));
    expect(body.indexOf("get_time")).toBeLessThan(body.indexOf("It is 09:41."));
  });
});
