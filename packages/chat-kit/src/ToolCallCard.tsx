import type { ToolCall } from "./types";

const label = { pending: "Running", result: "Done", error: "Failed" } as const;

const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

export function ToolCallCard({ call }: { call: ToolCall }) {
  return (
    <details className="ck-tool" data-state={call.state} open={call.state === "error" || undefined}>
      <summary>
        <span className="ck-tool__dot" aria-hidden="true" />
        <code className="ck-tool__name">{call.name}</code>
        <span className="ck-tool__state">{label[call.state]}</span>
      </summary>
      <div className="ck-tool__body">
        <div>
          <div className="ck-tool__label">Arguments</div>
          <pre>{pretty(call.args)}</pre>
        </div>
        {call.state === "result" && (
          <div>
            <div className="ck-tool__label">Result</div>
            <pre>{pretty(call.result)}</pre>
          </div>
        )}
        {call.state === "error" && (
          <p className="ck-tool__error" role="alert">
            {call.error}
          </p>
        )}
      </div>
    </details>
  );
}
