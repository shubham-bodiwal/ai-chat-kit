import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Keeps a scroll container pinned to the bottom while content grows,
 * but lets go as soon as the user scrolls up, and re-pins when they return.
 * `dep` should change whenever content changes (e.g. the messages array).
 */
export function useAutoScroll<T extends HTMLElement>(dep: unknown, threshold = 48) {
  const ref = useRef<T>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    pinned.current = bottom;
    setAtBottom(bottom);
  }, [threshold]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `dep` is the trigger; re-run whenever content changes
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [dep]);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    setAtBottom(true);
    // Instant on purpose: a smooth scroll emits mid-way scroll events that would un-pin.
    el.scrollTop = el.scrollHeight;
  }, []);

  return { ref, atBottom, onScroll, scrollToBottom };
}
