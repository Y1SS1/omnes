// The button look, also for links that act as buttons (a <Link> styled like the primary action).
export function buttonClass(variant: "primary" | "secondary" | "danger" | "ghost" = "primary") {
  const styles = {
    primary: "bg-brand text-on-brand hover:bg-brand-strong",
    secondary: "bg-paper text-ink border border-hairline hover:border-brand/40 hover:bg-brand-soft",
    danger: "bg-danger-soft text-ember hover:bg-danger-soft-strong",
    ghost: "text-mid-gray hover:bg-canvas hover:text-ink",
  }[variant];
  return `inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:cursor-not-allowed ${styles}`;
}
