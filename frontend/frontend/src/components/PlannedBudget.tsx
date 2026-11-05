import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FileSpreadsheet, Pencil, Trash2 } from "lucide-react";
import * as plannedItemsApi from "../api/plannedItems";
import { apiErrorMessage } from "../api/budgetProjects";
import type { BudgetItemType, PlannedItemDto } from "../api/types";
import { useCurrency } from "../context/CurrencyContext";
import { MoneyField } from "./money";
import { Button, Card, Input, Modal, PageTitle, Select } from "./ui";

const TYPE_LABEL: Record<BudgetItemType, string> = { Asset: "Activo", Liability: "Pasivo" };

type ProjectGroup = { id: string; name: string; items: PlannedItemDto[] };

function groupByProject(items: PlannedItemDto[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  for (const item of items) {
    const group = groups.get(item.budgetProjectId) ?? { id: item.budgetProjectId, name: item.budgetProjectName, items: [] };
    group.items.push(item);
    groups.set(item.budgetProjectId, group);
  }
  return [...groups.values()];
}

const total = (items: PlannedItemDto[], type?: BudgetItemType) =>
  items.filter((i) => type === undefined || i.type === type).reduce((sum, i) => sum + i.amount, 0);

// The wallet's "Presupuesto planificado": the items of the one Excel sent here from its budget
// page, editable. It is planned money, so it is compared with the balance but never moves it.
export function PlannedBudget({ balance }: { balance: number | null }) {
  const { formatMoney } = useCurrency();
  const [items, setItems] = useState<PlannedItemDto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState<PlannedItemDto | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<BudgetItemType>("Asset");
  const [amount, setAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    plannedItemsApi.getPlannedItems().then(setItems).catch(() => setLoadFailed(true));
  }, []);

  const openEditor = (item: PlannedItemDto) => {
    setEditing(item);
    setName(item.name);
    setCategory(item.category);
    setType(item.type);
    setAmount(item.amount);
    setFormError(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || amount === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await plannedItemsApi.updatePlannedItem(editing.id, { name, category, type, amount });
      setItems((current) => current && current.map((i) => (i.id === updated.id ? updated : i)));
      setEditing(null);
    } catch (err) {
      setFormError(apiErrorMessage(err, "No se pudo guardar el cambio. Intenta de nuevo."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: PlannedItemDto) => {
    if (!window.confirm(`¿Quitar "${item.name}" de tu presupuesto planificado? El presupuesto original no cambia.`)) return;
    setError(null);
    try {
      await plannedItemsApi.deletePlannedItem(item.id);
      setItems((current) => current && current.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo quitar el ítem. Intenta de nuevo."));
    }
  };

  const groups = groupByProject(items ?? []);
  const plannedTotal = total(items ?? []);
  const difference = balance === null ? null : balance - plannedTotal;

  return (
    <section aria-label="Presupuesto planificado" className="mb-8">
      <PageTitle
        title="Presupuesto planificado"
        subtitle="Los ítems del presupuesto que estás ejecutando. Puedes editarlos aquí sin cambiar el presupuesto original."
      />

      {loadFailed && <p className="text-sm text-ember mb-4">No se pudo cargar tu presupuesto planificado.</p>}
      {error && (
        <p role="alert" className="text-sm text-ember mb-4">
          {error}
        </p>
      )}

      {items !== null && items.length === 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-ink" aria-hidden="true">
              <FileSpreadsheet size={18} />
            </span>
            <p className="text-sm text-mid-gray">
              Todavía no tienes un presupuesto en tu billetera. Abre uno en{" "}
              <Link to="/" className="font-semibold text-brand hover:underline">
                Inicio
              </Link>{" "}
              y aprieta "Pasar a la billetera".
            </p>
          </div>
        </Card>
      )}

      {groups.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Card>
              <p className="text-sm text-mid-gray">Total planificado</p>
              <p className="font-display text-3xl font-extrabold tracking-tight tabular-nums text-ink">{formatMoney(plannedTotal)}</p>
              <p className="text-xs text-mid-gray mt-1">
                {items!.length} ítems
              </p>
            </Card>
            <Card>
              <p className="text-sm text-mid-gray">Activos · Pasivos</p>
              <p className="font-display text-xl font-extrabold tracking-tight tabular-nums text-ink mt-1">
                {formatMoney(total(items!, "Asset"))}
              </p>
              <p className="text-sm tabular-nums text-mid-gray">{formatMoney(total(items!, "Liability"))} en pasivos</p>
            </Card>
            <Card className={difference !== null && difference < 0 ? "ring-2 ring-ember/30" : ""}>
              <p className="text-sm text-mid-gray">Comparado con tu saldo</p>
              {difference === null ? (
                <p className="text-sm text-mid-gray mt-1">—</p>
              ) : difference >= 0 ? (
                <>
                  <p className="font-display text-3xl font-extrabold tracking-tight tabular-nums text-mint">Te alcanza</p>
                  <p className="text-xs text-mid-gray mt-1">Te sobran {formatMoney(difference)}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-3xl font-extrabold tracking-tight tabular-nums text-ember">
                    Faltan {formatMoney(-difference)}
                  </p>
                  <p className="text-xs text-mid-gray mt-1">Tu saldo no cubre todo lo planificado</p>
                </>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            {groups.map((group) => (
              <Card key={group.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <h3 className="text-lg font-extrabold">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-mid-gray">Presupuesto en ejecución</span>
                    <Link to={`/presupuestos/${group.id}`} className="hover:underline">
                      {group.name}
                    </Link>
                  </h3>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(total(group.items))}</span>
                </div>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full min-w-[34rem] table-fixed text-sm">
                    <colgroup>
                      <col />
                      <col className="w-[22%]" />
                      <col className="w-[13%]" />
                      <col className="w-[18%]" />
                      <col className="w-[5.5rem]" />
                    </colgroup>
                    <thead>
                      <tr className="text-left text-xs text-mid-gray">
                        <th className="font-medium px-2 py-2">Nombre</th>
                        <th className="font-medium px-2 py-2">Categoría</th>
                        <th className="font-medium px-2 py-2">Tipo</th>
                        <th className="font-medium px-2 py-2 text-right">Monto</th>
                        <th className="px-2 py-2">
                          <span className="sr-only">Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-2 py-2.5 font-medium text-ink break-words">{item.name}</td>
                          <td className="px-2 py-2.5 text-mid-gray break-words">{item.category}</td>
                          <td className="px-2 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                item.type === "Asset" ? "bg-brand-soft text-brand" : "bg-canvas text-mid-gray"
                              }`}
                            >
                              {TYPE_LABEL[item.type]}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">{formatMoney(item.amount)}</td>
                          <td className="px-2 py-2.5">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => openEditor(item)}
                                className="rounded-full p-1.5 text-mid-gray hover:bg-brand-soft hover:text-brand"
                                aria-label={`Editar ${item.name}`}
                              >
                                <Pencil size={15} aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => remove(item)}
                                className="rounded-full p-1.5 text-mid-gray hover:bg-red-50 hover:text-ember"
                                aria-label={`Quitar ${item.name}`}
                              >
                                <Trash2 size={15} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar ítem planificado">
        <form onSubmit={save} className="space-y-3">
          <div>
            <label htmlFor="planned-name" className="block text-sm font-medium mb-1">
              Nombre
            </label>
            <Input id="planned-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
          </div>
          <div>
            <label htmlFor="planned-category" className="block text-sm font-medium mb-1">
              Categoría
            </label>
            <Input id="planned-category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={200} required />
          </div>
          <div>
            <label htmlFor="planned-type" className="block text-sm font-medium mb-1">
              Tipo
            </label>
            <Select id="planned-type" value={type} onChange={(e) => setType(e.target.value as BudgetItemType)} className="w-full">
              <option value="Asset">Activo (se compra)</option>
              <option value="Liability">Pasivo (gasto fijo)</option>
            </Select>
          </div>
          <div>
            <span className="block text-sm font-medium mb-1">Monto</span>
            <MoneyField value={amount} onChange={setAmount} placeholder="Monto" required />
          </div>
          {formError && <p className="text-sm text-ember">{formError}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
