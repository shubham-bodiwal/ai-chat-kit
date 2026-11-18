import type { StreamEvent } from "@ai-chat-kit/react";
import { demoStream } from "@/lib/demo-stream";
import { openaiStream } from "@/lib/openai-stream";

const MAX_MESSAGES = 50;
const MAX_CHARS = 8000;

type Incoming = { role: "user" | "assistant"; content: string };

function parse(body: unknown): Incoming[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  const ok = messages.every(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length <= MAX_CHARS,
  );
  return ok ? messages.map(({ role, content }) => ({ role, content })) : null;
}

export async function POST(req: Request) {
  const messages = parse(await req.json().catch(() => null));
  if (!messages) return Response.json({ error: "Invalid messages" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (apiKey) {
          await openaiStream(
            {
              apiKey,
              baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
              model: process.env.MODEL || "gpt-4o-mini",
              tools: process.env.OPENAI_TOOLS !== "off",
            },
            messages.filter((m) => m.content),
            emit,
            req.signal,
          );
        } else {
          await demoStream(lastUser, emit, req.signal);
        }
      } catch (err) {
        if (!req.signal.aborted) emit({ type: "error", message: err instanceof Error ? err.message : "Stream failed" });
      }
      try {
        controller.close();
      } catch {
        /* client already went away */
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
