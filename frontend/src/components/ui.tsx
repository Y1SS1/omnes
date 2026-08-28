import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-neutral-900 rounded-xl border border-neutral-800 shadow-sm shadow-black/20 p-3 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color: "green" | "yellow" | "red" }) {
  const bg = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500" }[color];
  return (
    <div className="w-full h-4 bg-neutral-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${bg} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

export function CategoryLegend({ categories }: { categories: { id: string; name: string; color: string }[] }) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-xs text-neutral-400">
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
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-neutral-800 text-neutral-200 hover:bg-neutral-700",
    danger: "bg-red-950/60 text-red-400 hover:bg-red-950",
    ghost: "text-neutral-400 hover:bg-neutral-800",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-neutral-700 bg-neutral-950 text-white placeholder:text-neutral-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-neutral-950 text-white ${props.className ?? ""}`}
    />
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
