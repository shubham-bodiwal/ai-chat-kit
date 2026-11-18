import type { StreamEvent } from "@ai-chat-kit/react";
import { runTool } from "./tools";

type Emit = (e: StreamEvent) => void;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

/** Emit text in small irregular chunks, roughly the cadence of a real model. */
async function type(text: string, emit: Emit, signal: AbortSignal) {
  for (let i = 0; i < text.length; ) {
    const n = 2 + Math.floor(Math.random() * 5);
    emit({ type: "text", delta: text.slice(i, i + n) });
    i += n;
    await sleep(14, signal);
  }
}

const CODE_ANSWER = `Here's a small hook that streams NDJSON from a \`fetch\` response. It's the same idea this kit uses internally.

\`\`\`ts
export async function* readNdjson<T>(res: Response): AsyncGenerator<T> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line);
  }
}
\`\`\`

A few things worth noticing:

1. **Keep the partial line.** A network chunk can end mid-JSON, so the last fragment waits for the next read.
2. **Decode with \`stream: true\`.** Otherwise a multi-byte character split across chunks turns into garbage.
3. **Let abort propagate.** Passing an \`AbortSignal\` to \`fetch\` makes \`reader.read()\` reject, which is how the Stop button works.

| Format | Framing | Good for |
| --- | --- | --- |
| SSE | \`data:\` lines | Browser \`EventSource\`, proxies |
| NDJSON | one JSON per line | \`fetch\` + POST bodies |

Try scrolling up while this streams: the view stays where you put it.`;

export async function demoStream(lastUser: string, emit: Emit, signal: AbortSignal) {
  const q = lastUser.toLowerCase();
  await sleep(450, signal);

  if (/fail|error|broken/.test(q)) {
    await type("Let me look that up with a tool.", emit, signal);
    emit({ type: "tool-call", id: "call_err", name: "get_current_time", args: { timezone: "Mars/Olympus_Mons" } });
    await sleep(1200, signal);
    let message = "Tool failed";
    try {
      runTool("get_current_time", { timezone: "Mars/Olympus_Mons" });
    } catch (err) {
      message = err instanceof Error ? err.message : message;
    }
    emit({ type: "tool-error", id: "call_err", error: message });
    await sleep(300, signal);
    await type(
      "\n\nThat tool call failed, and the card shows the error inline instead of the whole reply dying. The model can explain what happened and carry on, and **Regenerate** reruns the turn.",
      emit,
      signal,
    );
    return;
  }

  if (/time|clock|tokyo|tool/.test(q)) {
    const zone = /london/.test(q) ? "Europe/London" : /new york|nyc/.test(q) ? "America/New_York" : "Asia/Tokyo";
    await type("I'll check the clock.", emit, signal);
    emit({ type: "tool-call", id: "call_time", name: "get_current_time", args: { timezone: zone } });
    await sleep(1100, signal);
    const result = runTool("get_current_time", { timezone: zone });
    emit({ type: "tool-result", id: "call_time", result });
    await sleep(250, signal);
    await type(
      `\n\nIt's **${result.time}** in \`${zone}\` right now.\n\nThe card above went from *Running* to *Done* as the result arrived. Expand it to see the arguments and the raw result.`,
      emit,
      signal,
    );
    return;
  }

  await type(CODE_ANSWER, emit, signal);
}
