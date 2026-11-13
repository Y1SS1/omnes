import { useState } from "react";
import { ListChecks, Sparkles, X } from "lucide-react";
import * as budgetProjectsApi from "../api/budgetProjects";
import type { BudgetItemType, BudgetProjectDto, BudgetReviewDto } from "../api/types";
import { useCurrency } from "../context/CurrencyContext";
import { MoneyInput } from "./money";
import { Button, Input } from "./ui";
import { Select } from "./Select";
import { ITEM_TYPE_OPTIONS } from "./itemTypeOptions";

// One run of "¿Qué me falta?". The page sends it to the AI from the search bar (on submit, so it
// never runs twice) and this panel shows it: waiting, failed, or the suggestions to pick from.
// `goal` is what was asked, kept even if the bar is edited later.
export type ReviewRun = {
  id: number;
  goal: string;
  loading: boolean;
  result: BudgetReviewDto | null;
  error: string | null;
};

type Row = {
  key: number;
  picked: boolean;
  name: string;
  category: string;
  type: BudgetItemType;
  amount: number | null;
  reason: string;
};

// The AI's suggestions, editable like a draft; only the picked ones are added, unquoted.
export function BudgetReviewPanel({
  run,
  projectId,
  inWallet,
  onAdded,
  onClose,
}: {
  run: ReviewRun;
  projectId: string;
  inWallet: boolean;
  onAdded: (project: BudgetProjectDto, count: number) => void;
  onClose: () => void;
}) {
  const { formatMoney } = useCurrency();
  // The page remounts this panel when a run starts and again when its result arrives, so the
  // rows always start from the result.
  const [rows, setRows] = useState<Row[]>(() =>
    (run.result?.suggestions ?? []).map((s, key) => ({
      key,
      picked: true,
      name: s.name,
      category: s.category,
      type: s.type,
      amount: s.estimatedAmount,
      reason: s.reason,
    }))
  );
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, change: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...change } : r)));

  const picked = rows.filter((r) => r.picked);
  const pickedTotal = picked.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const add = async () => {
    const incomplete = rows.findIndex((r) => r.picked && (!r.name.trim() || !r.category.trim() || r.amount === null || r.amount < 0));
    if (incomplete >= 0) {
      setError(`Completa el nombre, la categoría y el monto de la sugerencia ${incomplete + 1}.`);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const project = await budgetProjectsApi.addItems(
        projectId,
        picked.map((r) => ({ name: r.name.trim(), category: r.category.trim(), type: r.type, estimatedAmount: r.amount! }))
      );
      onAdded(project, picked.length);
    } catch (err) {
      setError(budgetProjectsApi.apiErrorMessage(err, "No se pudieron agregar los ítems. Intenta de nuevo."));
      setAdding(false);
    }
  };

  return (
    // No auto-scroll: the panel opens right under the search bar, already in view.
    <section
      aria-label="¿Qué me falta?"
      className="mb-6 rounded-[18px] border border-brand/40 bg-paper p-4 sm:p-5 scroll-mt-6 motion-safe:animate-panel-in"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <ListChecks size={20} className="text-accent" aria-hidden="true" />
          ¿Qué me falta?
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={adding}
          className="shrink-0 rounded-full p-1 text-mid-gray hover:text-ink"
          aria-label="Cerrar revisión"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {run.loading && (
        <div role="status" aria-live="polite" className="mt-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} className="text-accent motion-safe:animate-pulse" aria-hidden="true" />
            La IA está revisando tu presupuesto… suele tardar entre 5 y 15 segundos.
          </p>
          <div className="mt-3 space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-[10px] bg-canvas motion-safe:animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        </div>
      )}

      {run.error && (
        <p role="alert" className="mt-3 text-sm text-ember">
          {run.error}
        </p>
      )}

      {run.result && (
        <p className="mt-2 text-sm">
          <span className="text-mid-gray">Objetivo: </span>
          <span className="font-semibold">{run.goal}</span>
        </p>
      )}

      {run.result && rows.length === 0 && (
        <p role="status" className="mt-3 text-sm">
          <span className="font-semibold">La IA no encontró nada que agregar para ese objetivo.</span>{" "}
          <span className="text-mid-gray">Prueba escribiéndolo con más detalle.</span>
        </p>
      )}

      {run.result && rows.length > 0 && (
        <div className="mt-2 space-y-3">
          <p role="status" className="text-sm text-mid-gray">
            La IA sugiere {rows.length === 1 ? "1 ítem" : `${rows.length} ítems`}
            {" para tu objetivo"}. Desmarca lo que no
            necesites y corrige lo que quieras: se agregan sin cotizar
            {inWallet ? " y también a tu billetera" : ""}.
          </p>

          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li
                key={row.key}
                className={`rounded-[14px] p-2 transition-opacity ${row.picked ? "bg-surface-alt" : "bg-canvas opacity-60"}`}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.picked}
                    onChange={(e) => update(row.key, { picked: e.target.checked })}
                    disabled={adding}
                    aria-label={`Agregar ${row.name || `la sugerencia ${index + 1}`}`}
                    className="ml-1 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <Input
                    aria-label={`Nombre de la sugerencia ${index + 1}`}
                    value={row.name}
                    onChange={(e) => update(row.key, { name: e.target.value })}
                    maxLength={200}
                    disabled={adding || !row.picked}
                    className="font-semibold"
                  />
                </div>
                {row.reason && <p className="mt-1 ml-8 text-xs text-mid-gray">{row.reason}</p>}
                {row.picked && (
                  <div className="mt-2 ml-8 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem_9rem]">
                    <Input
                      aria-label={`Categoría de la sugerencia ${index + 1}`}
                      value={row.category}
                      onChange={(e) => update(row.key, { category: e.target.value })}
                      maxLength={200}
                      placeholder="Categoría"
                      disabled={adding}
                    />
                    <Select
                      aria-label={`Tipo de la sugerencia ${index + 1}`}
                      value={row.type}
                      options={ITEM_TYPE_OPTIONS}
                      onChange={(type) => update(row.key, { type })}
                      disabled={adding}
                    />
                    <div aria-label={`Monto de la sugerencia ${index + 1}`} role="group">
                      <MoneyInput value={row.amount} onChange={(amount) => update(row.key, { amount })} placeholder="Monto" />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-mid-gray">
              {`Te ${run.result.remainingToday === 1 ? "queda 1 revisión" : `quedan ${run.result.remainingToday} revisiones`} con IA hoy.`}
            </p>
            <Button onClick={add} disabled={adding || picked.length === 0}>
              {adding
                ? "Agregando..."
                : picked.length === 0
                  ? "Marca al menos un ítem"
                  : `Agregar ${picked.length === 1 ? "1 ítem" : `${picked.length} ítems`} (${formatMoney(pickedTotal)})`}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-ember">
          {error}
        </p>
      )}
    </section>
  );
}
