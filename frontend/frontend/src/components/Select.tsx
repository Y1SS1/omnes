import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { fieldClass } from "./ui";

export type SelectOption<T extends string> = { value: T; label: string };

type Placement = { top: number; left: number; width: number; up: boolean };

const MENU_MAX_HEIGHT = 256;
const GAP = 4;
const MIN_WIDTH = 128;
const EDGE = 8;

// Omnes' own dropdown, replacing the browser's <select>, whose open list cannot be styled.
// The list opens in a layer over the page (a portal), so tables that scroll sideways do not
// cut it off, and it pops in like the other menus. It works as a listbox: arrows, Home/End,
// Enter or Space to pick, Esc or Tab to close.
export function Select<T extends string>({
  value,
  options,
  onChange,
  id,
  disabled,
  size = "md",
  className = "",
  "aria-label": ariaLabel,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  id?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [active, setActive] = useState(0);
  const open = placement !== null;
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect || disabled) return;
    // Opens upward when there is not enough room below (e.g. the last rows of a table).
    const up = window.innerHeight - rect.bottom < MENU_MAX_HEIGHT && rect.top > window.innerHeight - rect.bottom;
    // As wide as its button, and kept inside the screen (long names are cut with "…").
    const width = Math.min(Math.max(rect.width, MIN_WIDTH), window.innerWidth - 2 * EDGE);
    const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - EDGE - width));
    setPlacement({ top: up ? rect.top - GAP : rect.bottom + GAP, left, width, up });
    setActive(selectedIndex);
  };

  const close = (refocus: boolean) => {
    setPlacement(null);
    if (refocus) buttonRef.current?.focus();
  };

  const pick = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    close(true);
  };

  // While open: the list takes the focus, and a click elsewhere, a scroll of the page or a
  // resize closes it (a fixed layer would otherwise drift away from its button).
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      // Stops here so a window this list sits in does not close too.
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const small = size === "sm";

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close(true) : openMenu())}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={`${fieldClass} flex w-full items-center justify-between gap-1.5 text-left transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60 ${
          small ? "!px-2.5 !py-1 text-xs" : ""
        } ${open ? "!border-brand !bg-paper ring-2 ring-brand-soft" : ""} ${className}`}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          size={small ? 14 : 16}
          className={`shrink-0 text-mid-gray transition-transform duration-200 ${open ? "rotate-180 text-accent" : ""}`}
          aria-hidden="true"
        />
      </button>

      {placement &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : id}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKeyDown}
            style={{
              position: "fixed",
              left: placement.left,
              top: placement.up ? undefined : placement.top,
              bottom: placement.up ? window.innerHeight - placement.top : undefined,
              width: placement.width,
              maxHeight: MENU_MAX_HEIGHT,
            }}
            className={`z-[60] overflow-y-auto rounded-[14px] border border-hairline bg-paper p-1 shadow-lg focus:outline-none motion-safe:animate-pop-in ${
              placement.up ? "origin-bottom-left" : "origin-top-left"
            }`}
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(index)}
                  className={`flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 ${small ? "text-xs" : "text-sm"} ${
                    isSelected ? "font-semibold text-accent" : "text-ink"
                  } ${index === active ? (isSelected ? "bg-brand-soft" : "bg-surface-alt") : ""}`}
                >
                  <Check size={14} className={`shrink-0 ${isSelected ? "" : "invisible"}`} aria-hidden="true" />
                  <span className="truncate">{option.label}</span>
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
