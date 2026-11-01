import { forwardRef, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-paper rounded-[24px] border border-hairline shadow-[0_0_0_1px_rgba(23,23,23,0.05),0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] p-3 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-ink tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-mid-gray mt-1">{subtitle}</p>}
    </div>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color: "green" | "yellow" | "red" }) {
  const bg = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500" }[color];
  return (
    <div className="w-full h-4 bg-neutral-200 rounded-full overflow-hidden">
      <div
        className={`h-full ${bg} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#EF4444", "#F59E0B", "#10B981", "#EC4899", "#6366F1", "#14B8A6"];

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

export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

export function CategoryLegend({ categories }: { categories: { id: string; name: string; color: string }[] }) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-xs text-mid-gray">
      {categories.map((c) => (
        <span key={c.id} className="flex items-center gap-1.5">
          <ColorDot color={c.color} />
          {c.name}
        </span>
      ))}
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
  const styles = {
    primary: "bg-ink text-white hover:bg-ink-soft",
    secondary: "bg-canvas text-ink hover:bg-neutral-200",
    danger: "bg-red-50 text-ember hover:bg-red-100",
    ghost: "text-mid-gray hover:bg-canvas hover:text-ink",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-[18px] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  props,
  ref
) {
  return (
    <input
      {...props}
      ref={ref}
      className={`w-full rounded-[18px] border border-transparent bg-canvas text-ink placeholder:text-mid-gray px-3 py-2 text-sm focus:outline-none focus:border-hairline focus:bg-paper focus:ring-1 focus:ring-hairline ${props.className ?? ""}`}
    />
  );
});

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-[18px] border border-transparent px-3 py-2 text-sm focus:outline-none focus:border-hairline focus:ring-1 focus:ring-hairline bg-canvas text-ink ${props.className ?? ""}`}
    />
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-paper border border-hairline rounded-[24px] shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-mid-gray hover:text-ink">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
