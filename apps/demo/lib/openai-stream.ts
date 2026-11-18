import type { StreamEvent } from "@ai-chat-kit/react";
import { runTool, timeTool } from "./tools";

type Emit = (e: StreamEvent) => void;
type Msg = Record<string, unknown>;

interface Config {
  baseUrl: string;
  apiKey: string;
  model: string;
  tools: boolean;
}

/** Streams one completion; text goes straight out, tool calls are collected and returned. */
async function complete(cfg: Config, messages: Msg[], withTools: boolean, emit: Emit, signal: AbortSignal) {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, stream: true, ...(withTools && { tools: [timeTool] }) }),
    signal,
  });
  if (!res.ok || !res.body) {
    // Don't echo the upstream body: it can contain account details.
    throw new Error(`Model endpoint returned ${res.status}`);
  }

  const calls: { id: string; name: string; args: string }[] = [];
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
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      const delta = JSON.parse(data).choices?.[0]?.delta;
      if (delta?.content) emit({ type: "text", delta: delta.content });
      for (const tc of delta?.tool_calls ?? []) {
        const c = (calls[tc.index ?? 0] ??= { id: "", name: "", args: "" });
        if (tc.id) c.id = tc.id;
        if (tc.function?.name) c.name += tc.function.name;
        if (tc.function?.arguments) c.args += tc.function.arguments;
      }
    }
  }
  return calls;
}

export async function openaiStream(cfg: Config, history: Msg[], emit: Emit, signal: AbortSignal) {
  const messages: Msg[] = [
    { role: "system", content: "You are a concise assistant. Use markdown. Use the time tool when asked about the time." },
    ...history,
  ];
  const calls = await complete(cfg, messages, cfg.tools, emit, signal);
  if (!calls.length) return;

  // ponytail: one tool round, then a plain answer. Loop here if you need multi-step agents.
  const toolMessages: Msg[] = [];
  for (const c of calls) {
    let args: unknown = {};
    try {
      args = c.args ? JSON.parse(c.args) : {};
    } catch {
      /* leave empty; the tool will report what's missing */
    }
    emit({ type: "tool-call", id: c.id, name: c.name, args });
    let content: string;
    try {
      const result = runTool(c.name, args);
      emit({ type: "tool-result", id: c.id, result });
      content = JSON.stringify(result);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Tool failed";
      emit({ type: "tool-error", id: c.id, error });
      content = JSON.stringify({ error });
    }
    toolMessages.push({ role: "tool", tool_call_id: c.id, content });
  }
  const assistant = {
    role: "assistant",
    content: null,
    tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })),
  };
  emit({ type: "text", delta: "\n\n" });
  await complete(cfg, [...messages, assistant, ...toolMessages], false, emit, signal);
}
