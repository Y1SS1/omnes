import { useEffect, useRef, useState, type FormEvent } from "react";
import { ListChecks, LoaderCircle, Search, SendHorizontal, X } from "lucide-react";
import { buttonClass } from "./buttonClass";

const MIN_GOAL = 5;
const MAX_GOAL = 300;

// "¿Qué me falta?" as a search bar: the button stretches (animated) into a field right where it
// sits, so asking never pushes the page down. Enter or the arrow sends the goal to the AI; the
// goal is required, since without one the AI can only give generic advice.
export function ReviewSearchBar({
  open,
  goal,
  loading,
  disabled,
  onOpen,
  onGoalChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  goal: string;
  loading: boolean;
  disabled: boolean;
  onOpen: () => void;
  onGoalChange: (goal: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Set when Enter is pressed on a too-short goal: shows a hint instead of asking the AI.
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open) {
    return (
      <button type="button" onClick={onOpen} disabled={disabled} className={buttonClass("secondary")}>
        <ListChecks size={16} aria-hidden="true" />
        ¿Qué me falta?
      </button>
    );
  }

  const ready = goal.trim().length >= MIN_GOAL;
  const close = () => {
    setNudge(false);
    onClose();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!ready) {
      setNudge(true);
      inputRef.current?.focus();
      return;
    }
    onSubmit();
  };

  return (
    <form
      role="search"
      aria-label="¿Qué me falta?"
      onSubmit={submit}
      className="relative flex w-full items-center gap-1 rounded-full border border-brand bg-paper py-1 pl-3.5 pr-1 shadow-sm ring-2 ring-brand-soft sm:w-[28rem] motion-safe:animate-search-open"
    >
      <Search size={16} className="shrink-0 text-mid-gray" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={goal}
        onChange={(e) => {
          onGoalChange(e.target.value);
          setNudge(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !loading) close();
          // With the arrow disabled the browser skips the submit on Enter, so the hint is shown here.
          if (e.key === "Enter" && !ready) {
            e.preventDefault();
            setNudge(true);
          }
        }}
        maxLength={MAX_GOAL}
        disabled={loading}
        aria-label="¿Qué quieres lograr?"
        aria-invalid={nudge || undefined}
        aria-describedby={nudge ? "review-goal-hint" : undefined}
        placeholder="¿Qué quieres lograr? Ej: duplicar la venta de pollos"
        className="min-w-0 flex-1 bg-transparent py-1 text-sm text-ink placeholder:text-mid-gray focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={loading || !ready}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand hover:bg-brand-strong disabled:bg-surface-alt disabled:text-mid-gray disabled:hover:bg-surface-alt"
        aria-label={loading ? "Revisando con IA" : "Revisar con IA"}
      >
        {loading ? (
          <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <SendHorizontal size={16} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={close}
        disabled={loading}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mid-gray hover:bg-canvas hover:text-ink disabled:opacity-50"
        aria-label="Cerrar"
      >
        <X size={16} aria-hidden="true" />
      </button>
      {/* Floats under the bar, so showing it never moves the page. */}
      {nudge && (
        <p
          id="review-goal-hint"
          role="alert"
          className="absolute left-3 top-full z-10 mt-1.5 rounded-[10px] border border-hairline bg-paper px-3 py-1.5 text-xs text-ember shadow-md motion-safe:animate-panel-in"
        >
          Escribe qué quieres lograr para que la IA te recomiende qué agregar.
        </p>
      )}
    </form>
  );
}
