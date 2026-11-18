import { isValidElement, memo, useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked; the code is still selectable */
    }
  };
  return (
    <figure className="ck-code">
      <figcaption className="ck-code__bar">
        <span>{language ?? "text"}</span>
        <button type="button" className="ck-btn ck-btn--ghost" onClick={copy}>
          {copied ? "Copied" : "Copy"}
          <span className="ck-sr-only"> code</span>
        </button>
      </figcaption>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable code must be keyboard-reachable */}
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

const components: Components = {
  pre({ children }) {
    const child = (Array.isArray(children) ? children[0] : children) as ReactNode;
    if (!isValidElement(child)) return <pre>{children}</pre>;
    const { className, children: code } = (child as ReactElement<{ className?: string; children?: ReactNode }>).props;
    const language = /language-([\w-]+)/.exec(className ?? "")?.[1];
    return <CodeBlock language={language} code={String(code ?? "").replace(/\n$/, "")} />;
  },
  a({ node: _node, ...props }) {
    return <a {...props} target="_blank" rel="noreferrer noopener" />;
  },
};

/** GitHub-flavoured markdown. Raw HTML is not rendered, so model output can't inject markup. */
export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="ck-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
