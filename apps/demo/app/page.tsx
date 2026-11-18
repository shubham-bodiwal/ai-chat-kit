import { ChatApp } from "./chat-app";

export default function Page() {
  const live = Boolean(process.env.OPENAI_API_KEY);
  return <ChatApp mode={live ? (process.env.MODEL || "gpt-4o-mini") : null} />;
}

export const dynamic = "force-dynamic";
