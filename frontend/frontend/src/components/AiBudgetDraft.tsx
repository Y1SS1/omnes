import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Plus, Sparkles, Trash2 } from "lucide-react";
import * as budgetProjectsApi from "../api/budgetProjects";
import type { BudgetItemType } from "../api/types";
import { useCurrency } from "../context/CurrencyContext";
import { MoneyField, MoneyInput } from "./money";
import { Button, Input, Select } from "./ui";

const MAX_DESCRIPTION = 500;
const MIN_DESCRIPTION = 10;
const MAX_ITEMS = 50;

type Row = { key: number; name: string; category: string; type: BudgetItemType; amount: number | null };

// "Describir con IA": the AI proposes the items of a budget from a description, the user
// edits that list, and only "Crear presupuesto" saves it. No AI runs on save.
export function AiBudgetDraft() {
  const navigate = useNavigate();
  const { formatMoney } = useCurrency();
  const nextKey = useRef(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the last generation produced, shown above the list so the result is noticed.
  const [notice, setNotice] = useState<{ count: number; total: number } | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

  // The list renders below the form, often out of view: bring it up once it arrives and move
  // keyboard and screen-reader focus to its heading.
  useEffect(() => {
    if (!notice) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    listHeadingRef.current?.focus({ preventScroll: true });
  }, [notice]);

  const newRow = (fields: Omit<Row, "key">): Row => ({ key: nextKey.current++, ...fields });

  const generate = async (e?: FormEvent) => {
    e?.preventDefault();
    if (description.trim().length < MIN_DESCRIPTION) {
      setError(`Describe tu proyecto con al menos ${MIN_DESCRIPTION} caracteres.`);
      return;
    }
    if (rows && !window.confirm("Se reemplazará la lista actual, incluidos tus cambios. ¿Generar otra?")) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const draft = await budgetProjectsApi.draftBudget(description.trim(), target);
      setRows(draft.items.map((i) => newRow({ name: i.name, category: i.category, type: i.type, amount: i.estimatedAmount })));
      setRemaining(draft.remainingToday);
      setNotice({ count: draft.items.length, total: draft.items.reduce((sum, i) => sum + i.estimatedAmount, 0) });
    } catch (err) {
      setError(budgetProjectsApi.apiErrorMessage(err, "No se pudo generar el presupuesto con IA. Intenta de nuevo."));
    } finally {
      setGenerating(false);
    }
  };

  const update = (key: number, change: Partial<Row>) =>
    setRows((current) => current && current.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const remove = (key: number) => setRows((current) => current && current.filter((r) => r.key !== key));
  const add = () =>
    setRows((current) => [...(current ?? []), newRow({ name: "", category: "", type: "Asset", amount: null })]);

  const save = async () => {
    if (!rows) return;
    if (!name.trim()) {
      setError("Ponle un nombre al presupuesto.");
      return;
    }
    if (rows.length === 0) {
      setError("El presupuesto debe tener al menos un ítem.");
      return;
    }
    const incomplete = rows.findIndex((r) => !r.name.trim() || !r.category.trim() || r.amount === null || r.amount < 0);
    if (incomplete >= 0) {
      setError(`Completa el nombre, la categoría y el monto del ítem ${incomplete + 1}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const project = await budgetProjectsApi.createProject(
        name.trim(),
        rows.map((r) => ({ name: r.name.trim(), category: r.category.trim(), type: r.type, estimatedAmount: r.amount! }))
      );
      navigate(`/presupuestos/${project.id}`, { state: { created: "ai" } });
    } catch (err) {
      setError(budgetProjectsApi.apiErrorMessage(err, "No se pudo crear el presupuesto. Intenta de nuevo."));
      setSaving(false);
    }
  };

  const total = (type?: BudgetItemType) =>
    (rows ?? []).filter((r) => type === undefined || r.type === type).reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const busy = generating || saving;

  return (
    <div className="space-y-4">
      <form onSubmit={generate} className="space-y-4">
        <div>
          <label htmlFor="ai-budget-name" className="block text-sm font-medium mb-1">
            Nombre del presupuesto
          </label>
          <Input
            id="ai-budget-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Pollería centro"
            maxLength={200}
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor="ai-budget-description" className="block text-sm font-medium mb-1">
            Describe tu proyecto
          </label>
          <textarea
            id="ai-budget-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MAX_DESCRIPTION}
            rows={3}
            disabled={busy}
            placeholder="Ej: Quiero abrir una pollería pequeña para 20 personas, con delivery, en Santiago."
            className="w-full rounded-[14px] border border-transparent bg-canvas text-ink placeholder:text-mid-gray px-3 py-2 text-sm focus:outline-none focus:border-brand focus:bg-paper focus:ring-2 focus:ring-brand-soft resize-y"
          />
          <p className="text-xs text-mid-gray text-right">
            {description.length}/{MAX_DESCRIPTION}
          </p>
        </div>
        <div>
          <span className="block text-sm font-medium mb-1">Monto aproximado (opcional)</span>
          <MoneyField value={target} onChange={setTarget} placeholder="Ej: 8.000.000" />
          <p className="text-xs text-mid-gray mt-1">Si lo indicas, la IA ajusta la lista para acercarse a ese total.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-mid-gray">
            {remaining !== null
              ? `Te ${remaining === 1 ? "queda 1 generación" : `quedan ${remaining} generaciones`} con IA hoy.`
              : "La IA propone una lista que puedes editar antes de guardarla."}
          </p>
          <Button type="submit" disabled={busy}>
            <Sparkles size={16} aria-hidden="true" />
            {generating ? "Generando..." : rows ? "Generar otra lista" : "Generar lista con IA"}
          </Button>
        </div>
      </form>

      {generating && (
        <div role="status" aria-live="polite" className="border-t border-hairline pt-4">
          <div className="rounded-[14px] border border-hairline bg-surface-alt p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} className="text-accent motion-safe:animate-pulse" aria-hidden="true" />
              La IA está armando tu presupuesto… suele tardar entre 5 y 15 segundos.
            </p>
            <div className="mt-3 space-y-2" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-9 rounded-[10px] bg-canvas motion-safe:animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {rows && !generating && (
        <section ref={listRef} aria-label="Lista propuesta por la IA" className="border-t border-hairline pt-4 space-y-3 scroll-mt-6">
          {notice && (
            <p role="status" className="flex items-start gap-2 rounded-[14px] border border-mint/40 bg-mint/10 px-4 py-3 text-sm">
              <CircleCheck size={18} className="mt-px shrink-0 text-mint" aria-hidden="true" />
              <span>
                <span className="font-semibold">Listo: la IA propuso {notice.count} ítems por {formatMoney(notice.total)}.</span>{" "}
                Revísalos, corrige lo que quieras y aprieta "Crear presupuesto".
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 ref={listHeadingRef} tabIndex={-1} className="text-lg font-extrabold focus:outline-none">
              Revisa la lista
            </h2>
            <p className="text-xs text-mid-gray tabular-nums">
              Activos {formatMoney(total("Asset"))} · Pasivos {formatMoney(total("Liability"))} ·{" "}
              <span className="font-semibold text-ink">Total {formatMoney(total())}</span>
            </p>
          </div>
          <p className="text-xs text-mid-gray">
            Son montos estimados por la IA. Corrige lo que quieras; los precios reales se cotizan después, en el presupuesto.
          </p>

          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li
                key={row.key}
                className="grid grid-cols-1 gap-2 rounded-[14px] bg-surface-alt p-2 sm:grid-cols-[minmax(0,1fr)_7.5rem_9rem_2.25rem] sm:items-center"
              >
                {/* The name gets its own full-width line: the AI writes long, specific names. */}
                <Input
                  aria-label={`Nombre del ítem ${index + 1}`}
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  maxLength={200}
                  placeholder="Nombre"
                  disabled={saving}
                  className="font-semibold sm:col-span-4"
                />
                <Input
                  aria-label={`Categoría del ítem ${index + 1}`}
                  value={row.category}
                  onChange={(e) => update(row.key, { category: e.target.value })}
                  maxLength={200}
                  placeholder="Categoría"
                  disabled={saving}
                />
                <Select
                  aria-label={`Tipo del ítem ${index + 1}`}
                  value={row.type}
                  onChange={(e) => update(row.key, { type: e.target.value as BudgetItemType })}
                  disabled={saving}
                  className="w-full"
                >
                  <option value="Asset">Activo</option>
                  <option value="Liability">Pasivo</option>
                </Select>
                <div aria-label={`Monto del ítem ${index + 1}`} role="group">
                  <MoneyInput value={row.amount} onChange={(amount) => update(row.key, { amount })} placeholder="Monto" />
                </div>
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  disabled={saving}
                  className="justify-self-end rounded-full p-2 text-mid-gray hover:bg-danger-soft hover:text-ember"
                  aria-label={`Quitar ${row.name || `el ítem ${index + 1}`}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {rows.length < MAX_ITEMS && (
            <button
              type="button"
              onClick={add}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              <Plus size={16} aria-hidden="true" />
              Agregar ítem
            </button>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={busy || rows.length === 0}>
              {saving ? "Creando..." : "Crear presupuesto"}
            </Button>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-ember whitespace-pre-line">
          {error}
        </p>
      )}
    </div>
  );
}
