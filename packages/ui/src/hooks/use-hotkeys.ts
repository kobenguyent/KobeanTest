import { useEffect } from 'react';

export interface HotkeyConfig {
  key: string;
  ctrlOrMeta?: boolean;
  shift?: boolean;
  handler: () => void;
  description?: string;
  allowInInputs?: boolean;
}

export function useHotkeys(hotkeys: HotkeyConfig[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if target is an interactive input element
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      for (const hk of hotkeys) {
        if (isInput && !hk.allowInInputs) {
          continue;
        }

        const matchesKey = e.key.toLowerCase() === hk.key.toLowerCase();
        const matchesMeta = hk.ctrlOrMeta ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
        const matchesShift = hk.shift ? e.shiftKey : !e.shiftKey;

        if (matchesKey && matchesMeta && matchesShift) {
          e.preventDefault();
          hk.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys, enabled]);
}
