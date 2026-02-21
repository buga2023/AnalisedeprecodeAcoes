import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface SuggestionItem {
  ticker: string;
  label: string;
  market: "BR" | "US" | "CRYPTO";
}

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (ticker: string) => void;
  suggestions: SuggestionItem[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const MARKET_BADGE: Record<SuggestionItem["market"], { text: string; className: string }> = {
  BR: { text: "B3", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  US: { text: "US", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  CRYPTO: { text: "CRYPTO", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export const Autocomplete: React.FC<AutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  disabled,
  className,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const showDropdown = isOpen && suggestions.length > 0 && value.length >= 1;

  useEffect(() => {
    if (suggestions.length > 0 && value.length >= 1) {
      setIsOpen(true);
      setActiveIndex(-1);
    }
  }, [suggestions, value]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (ticker: string) => {
      onSelect(ticker);
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex].ticker);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0 && value.length >= 1) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
      />
      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-border bg-slate-950 shadow-xl"
        >
          {suggestions.map((item, index) => {
            const badge = MARKET_BADGE[item.market];
            return (
              <li
                key={`${item.ticker}-${item.market}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item.ticker);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "cursor-pointer px-3 py-2 flex items-center justify-between gap-2 transition-colors",
                  index === activeIndex
                    ? "bg-primary/20"
                    : "hover:bg-primary/10"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "text-sm font-black shrink-0",
                    index === activeIndex ? "text-primary" : "text-foreground"
                  )}>
                    {item.ticker}
                  </span>
                  {item.label !== item.ticker && (
                    <span className="text-xs text-muted-foreground truncate">
                      {item.label}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0",
                  badge.className
                )}>
                  {badge.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
