import { useEffect, useRef, useState } from 'react';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  items,
  placeholder = 'Type a command or search test cases...',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          selected.onSelect();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm transition-opacity duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-2xl transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 border-b border-[var(--border)]">
          <svg
            className="w-4 h-4 mr-3 text-[var(--muted)] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" x2="16.65" y1="21" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="w-full h-12 bg-transparent text-[13px] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted)] bg-[var(--canvas)] border border-[var(--border)] rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[var(--muted)]">
              No matching results found
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-3 py-2 rounded text-[13px] cursor-pointer transition-colors duration-100 ${
                    isSelected
                      ? 'bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)]'
                      : 'text-[var(--text)] hover:bg-[var(--canvas)]/50 border border-transparent'
                  }`}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                      {item.category}
                    </span>
                    <span>{item.title}</span>
                  </div>
                  {item.shortcut && (
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted)] bg-[var(--canvas)] border border-[var(--border)] rounded">
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 text-[11px] text-[var(--muted)] bg-[var(--canvas)]/40 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-mono">↵</kbd> to select
            </span>
          </div>
          <span className="font-mono tabular-nums text-[10px]">
            {filtered.length} results
          </span>
        </div>
      </div>
    </div>
  );
}
