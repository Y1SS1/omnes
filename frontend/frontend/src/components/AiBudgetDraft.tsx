import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Plus, Sparkles, Trash2 } from "lucide-react";
import * as budgetProjectsApi from "../api/budgetProjects";
import type { BudgetItemType } from "../api/types";
import { useCurrency } from "../context/CurrencyContext";
import { MoneyField, MoneyInput } from "./money";
import { Button, Card, Input } from "./ui";
import { Select } from "./Select";
import { ITEM_TYPE_OPTIONS } from "./itemTypeOptions";
import { useConfirm } from "./useConfirm";

const MAX_DESCRIPTION = 500;
const MIN_DESCRIPTION = 10;
const MAX_ITEMS = 50;

// Columns of the review sheet. On phones the name takes a full line and the rest go below it.
const SHEET_COLUMNS = "grid-cols-[minmax(0,1fr)_6rem_7.5rem_2rem] sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_6.5rem_8rem_2rem]";
// A field that reads as plain text in the sheet and only shows its box on hover or focus.
const PLAIN_FIELD = "!bg-transparent !px-2 !py-1.5 hover:!bg-paper focus:!bg-paper";

type Row = {
  key: number;
  name: string;
  category: string;
  type: BudgetItemType;
  amount: number | null;
};

// "Describir con IA": the AI proposes the items of a budget from a description, the user
// edits that list, and only "Crear presupuesto" saves it. No AI runs on save.
// On wide screens the form sits on the left; the right column shows the user's budgets
// (history) until the AI starts, then the list to review takes that place.
export function AiBudgetDraft({ tabs, history }: { tabs: ReactNode; history: ReactNode }) {
  const { confirm, confirmDialog } = useConfirm();
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
    listRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
    listHeadingRef.current?.focus({ preventScroll: true });
  }, [notice]);

  const newRow = (fields: Omit<Row, "key">): Row => ({
    key: nextKey.current++,
    ...fields,
  });

  const generate = async (e?: FormEvent) => {
    e?.preventDefault();
    if (description.trim().length < MIN_DESCRIPTION) {
      setError(`Describe tu proyecto con al menos ${MIN_DESCRIPTION} caracteres.`);
      return;
    }
    if (
      rows &&
      !(await confirm({
        title: "¿Generar otra lista?",
        message: "Se reemplazará la lista actual, incluidos los cambios que le hiciste.",
        confirmLabel: "Generar otra",
      }))
    )
      return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const draft = await budgetProjectsApi.draftBudget(description.trim(), target);
      setRows(
        draft.items.map((i) =>
          newRow({
            name: i.name,
            category: i.category,
            type: i.type,
            amount: i.estimatedAmount,
          }),
        ),
      );
      setRemaining(draft.remainingToday);
      setNotice({
        count: draft.items.length,
        total: draft.items.reduce((sum, i) => sum + i.estimatedAmount, 0),
      });
    } catch (err) {
      setError(budgetProjectsApi.apiErrorMessage(err, "No se pudo generar el presupuesto con IA. Intenta de nuevo."));
    } finally {
      setGenerating(false);
    }
  };

  const update = (key: number, change: Partial<Row>) =>
    setRows((current) => current && current.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const remove = (key: number) => setRows((current) => current && current.filter((r) => r.key !== key));
  const add = () => setRows((current) => [...(current ?? []), newRow({ name: "", category: "", type: "Asset", amount: null })]);

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
        rows.map((r) => ({
          name: r.name.trim(),
          category: r.category.trim(),
          type: r.type,
          estimatedAmount: r.amount!,
        })),
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

  const errorNote = error && (
    <p role="alert" className="text-sm text-ember whitespace-pre-line motion-safe:animate-panel-in">
      {error}
    </p>
  );
  const showList = generating || rows !== null;

  return (
    <div
      className={`grid grid-cols-1 gap-6 lg:items-start ${
        showList ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      }`}
    >
      {confirmDialog}
      <Card>
        {tabs}
        <div className="space-y-4 motion-safe:animate-fade-in">
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
          {!rows && errorNote}
        </div>
      </Card>

      {!showList && history}

      {showList && (
        <Card className="motion-safe:animate-panel-in lg:flex lg:max-h-[calc(100vh-13rem)] lg:min-h-[24rem] lg:flex-col">
          {generating && (
            <div role="status" aria-live="polite">
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
            <section ref={listRef} aria-label="Lista propuesta por la IA" className="flex min-h-0 flex-1 flex-col gap-3 scroll-mt-6">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 ref={listHeadingRef} tabIndex={-1} className="text-lg font-extrabold focus:outline-none">
                  Revisa la lista
                  <span className="ml-2 text-sm font-medium text-mid-gray">
                    {rows.length} {rows.length === 1 ? "ítem" : "ítems"}
                  </span>
                </h2>
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
              </div>
              {notice && (
                <p role="status" className="flex items-center gap-1.5 text-xs text-mint motion-safe:animate-panel-in">
                  <CircleCheck size={14} className="shrink-0" aria-hidden="true" />
                  <span>
                    La IA propuso {notice.count} ítems por {formatMoney(notice.total)}. Corrige lo que quieras y aprieta "Crear
                    presupuesto".
                  </span>
                </p>
              )}

              {/* A compact sheet: one line per item, fields that look like plain text until hovered or
                  focused, and its own scroll so a long list never stretches the page. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-hairline">
                <div className="max-h-[60vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
                  <div
                    aria-hidden="true"
                    className={`sticky top-0 z-10 hidden ${SHEET_COLUMNS} border-b border-hairline bg-surface-alt px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-mid-gray sm:grid`}
                  >
                    <span className="px-2">Ítem</span>
                    <span className="px-2">Categoría</span>
                    <span className="px-2">Tipo</span>
                    <span className="px-2 text-right">Monto</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-hairline">
                    {rows.map((row, index) => (
                      <li key={row.key} className={`grid ${SHEET_COLUMNS} items-center gap-x-1.5 gap-y-1 px-2 py-1 hover:bg-canvas/60`}>
                        <Input
                          aria-label={`Nombre del ítem ${index + 1}`}
                          title={row.name}
                          value={row.name}
                          onChange={(e) => update(row.key, { name: e.target.value })}
                          maxLength={200}
                          placeholder="Nombre"
                          disabled={saving}
                          className={`${PLAIN_FIELD} col-span-4 font-semibold sm:col-span-1`}
                        />
                        <Input
                          aria-label={`Categoría del ítem ${index + 1}`}
                          title={row.category}
                          value={row.category}
                          onChange={(e) => update(row.key, { category: e.target.value })}
                          maxLength={200}
                          placeholder="Categoría"
                          disabled={saving}
                          className={PLAIN_FIELD}
                        />
                        <Select
                          aria-label={`Tipo del ítem ${index + 1}`}
                          value={row.type}
                          options={ITEM_TYPE_OPTIONS}
                          onChange={(type) => update(row.key, { type })}
                          disabled={saving}
                          size="sm"
                          className="!bg-transparent hover:!bg-paper"
                        />
                        <div aria-label={`Monto del ítem ${index + 1}`} role="group">
                          <MoneyInput
                            value={row.amount}
                            onChange={(amount) => update(row.key, { amount })}
                            placeholder="Monto"
                            className={`${PLAIN_FIELD} text-right tabular-nums`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(row.key)}
                          disabled={saving}
                          className="justify-self-end rounded-full p-1.5 text-mid-gray hover:bg-danger-soft hover:text-ember"
                          aria-label={`Quitar ${row.name || `el ítem ${index + 1}`}`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {errorNote}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3 shrink-0">
                <p className="text-xs text-mid-gray tabular-nums">
                  Activos {formatMoney(total("Asset"))} · Pasivos {formatMoney(total("Liability"))}
                  <span className="block text-base font-extrabold text-ink">Total {formatMoney(total())}</span>
                </p>
                <Button onClick={save} disabled={busy || rows.length === 0}>
                  {saving ? "Creando..." : "Crear presupuesto"}
                </Button>
              </div>
            </section>
          )}
        </Card>
      )}
    </div>
  );
}
