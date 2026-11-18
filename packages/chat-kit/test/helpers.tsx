import { Composer, MessageList, useChat } from "../src";
import type { StreamEvent } from "../src";

/** A fetch whose response body we push events into by hand, and which honours abort. */
export function controllableFetch() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const enc = new TextEncoder();
  const calls: { body: { messages: { role: string; content: string }[] }; signal: AbortSignal }[] = [];
  const fetchMock = async (_url: RequestInfo | URL, init?: RequestInit) => {
    const signal = init!.signal!;
    calls.push({ body: JSON.parse(String(init!.body)), signal });
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        ctrl = c;
        signal.addEventListener("abort", () => c.error(new DOMException("Aborted", "AbortError")));
      },
    });
    return new Response(stream, { status: 200 });
  };
  return {
    fetch: fetchMock as typeof fetch,
    calls,
    push: (e: StreamEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n")),
    close: () => ctrl.close(),
  };
}

export function Chat({ fetch }: { fetch: typeof globalThis.fetch }) {
  const chat = useChat({ api: "/api/chat", fetch });
  return (
    <>
      <MessageList messages={chat.messages} status={chat.status} error={chat.error} onRegenerate={chat.regenerate} />
      <Composer status={chat.status} onSend={chat.send} onStop={chat.stop} />
    </>
  );
}
