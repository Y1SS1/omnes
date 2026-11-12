import { forwardRef, useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { buttonClass } from "./buttonClass";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-paper rounded-[20px] border border-hairline shadow-[0_1px_2px_rgba(26,27,29,0.06)] p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl sm:text-[34px] font-extrabold text-ink tracking-tight leading-tight text-balance">
        {title}
      </h1>
      {subtitle && <p className="text-sm text-mid-gray mt-2">{subtitle}</p>}
    </div>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color: "green" | "yellow" | "red" }) {
  const bg = { green: "bg-mint", yellow: "bg-warn-soft0", red: "bg-ember" }[color];
  return (
    <div className="w-full h-3 bg-canvas rounded-full overflow-hidden">
      <div
        className={`h-full ${bg} rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

// Tones that all keep white initials readable (4.5:1 or more).
const AVATAR_COLORS = ["#b34a0a", "#3d3f43", "#8a3a0a", "#4b5563", "#9a4209", "#2f3540"];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Avatar({ name, id, size = 32, className = "" }: { name: string; id?: string; size?: number; className?: string }) {
  const color = AVATAR_COLORS[hashString(id ?? name) % AVATAR_COLORS.length];
  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold text-white shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: color, fontSize: Math.max(10, size * 0.4) }}
      title={name}
    >
      {initialsOf(name)}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${buttonClass(variant)} ${className}`}>
      {children}
    </button>
  );
}


// Shared look for text fields and selects; width is left to each caller.
export const fieldClass =
  "rounded-[14px] border border-transparent bg-canvas text-ink placeholder:text-mid-gray px-3 py-2 text-sm focus:outline-none focus:border-brand focus:bg-paper focus:ring-2 focus:ring-brand-soft";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  props,
  ref
) {
  return <input {...props} ref={ref} className={`w-full ${fieldClass} ${props.className ?? ""}`} />;
});

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full ${fieldClass} ${props.className ?? ""}`} />;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-paper border border-hairline rounded-[24px] shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-extrabold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-mid-gray hover:bg-canvas hover:text-ink" aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
