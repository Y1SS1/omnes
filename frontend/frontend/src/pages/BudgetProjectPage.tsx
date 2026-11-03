import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Sparkles, Star } from "lucide-react";
import * as budgetProjectsApi from "../api/budgetProjects";
import type { BudgetItemDto, BudgetItemType, BudgetProjectDto } from "../api/types";
import { Button, Card, PageTitle, ProgressBar, Select } from "../components/ui";

const QUOTES_AT_ONCE = 5;
const NOT_QUOTABLE = "No se cotiza";
const NOT_QUOTED_YET = "Sin cotizar";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

// A failed quote is usually temporary, so it gets one more try. Other answers,
// such as the daily limit, would only repeat themselves.
async function quoteWithRetry(projectId: string, itemId: string) {
  try {
    return await budgetProjectsApi.quoteItem(projectId, itemId);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status !== undefined && status !== 503) throw error;
    return await budgetProjectsApi.quoteItem(projectId, itemId);
  }
}

export default function BudgetProjectPage() {
  const { id = "" } = useParams();
  const [project, setProject] = useState<BudgetProjectDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [changingType, setChangingType] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leftPage = useRef(false);

  const quoting = progress !== null;

  useEffect(() => {
    budgetProjectsApi.getProject(id).then(setProject).catch(() => setNotFound(true));
  }, [id]);

  // Every remaining quote spends credit, so stop asking for more once the user leaves.
  useEffect(() => {
    leftPage.current = false;
    return () => {
      leftPage.current = true;
    };
  }, []);

  useEffect(() => {
    if (!quoting) return;
    const warnBeforeClosing = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warnBeforeClosing);
    return () => window.removeEventListener("beforeunload", warnBeforeClosing);
  }, [quoting]);

  const generate = async () => {
    if (!project) return;
    const queue = project.items.filter((item) => item.type === "Asset").map((item) => item.id);
    const total = queue.length;
    let done = 0;
    let failed = 0;
    let blockedBy: string | null = null;

    setError(null);
    setProgress({ done, total });

    const worker = async () => {
      while (queue.length > 0 && blockedBy === null && !leftPage.current) {
        const itemId = queue.shift()!;
        try {
          const updated = await quoteWithRetry(project.id, itemId);
          setProject((current) =>
            current && { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) }
          );
        } catch (err) {
          if ((err as { response?: { status?: number } }).response?.status === 429) {
            blockedBy = budgetProjectsApi.apiErrorMessage(err, "Llegaste al máximo de cotizaciones por hoy.");
          } else {
            failed++;
          }
        }
        done++;
        setProgress({ done, total });
      }
    };
    await Promise.all(Array.from({ length: QUOTES_AT_ONCE }, worker));

    setProgress(null);
    if (blockedBy) {
      setError(blockedBy);
    } else if (failed > 0) {
      setError(
        `${failed === 1 ? "1 ítem no se pudo cotizar" : `${failed} ítems no se pudieron cotizar`}. Aprieta el botón otra vez para reintentar; lo ya cotizado hoy no se vuelve a cobrar.`
      );
    }
  };

  const changeType = async (item: BudgetItemDto, type: BudgetItemType) => {
    if (!project) return;
    setChangingType(true);
    setError(null);
    try {
      await budgetProjectsApi.updateItemType(project.id, item.id, type);
      // Reloaded because the new type moves the item to the other group.
      setProject(await budgetProjectsApi.getProject(project.id));
    } catch (err) {
      setError(budgetProjectsApi.apiErrorMessage(err, "No se pudo cambiar el tipo. Intenta de nuevo."));
    } finally {
      setChangingType(false);
    }
  };

  const download = async () => {
    if (!project) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await budgetProjectsApi.downloadExcel(project.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Presupuesto actualizado - ${project.name}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar el Excel. Intenta de nuevo.");
    } finally {
      setDownloading(false);
    }
  };

  if (notFound) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-mid-gray mb-3">No encontramos este presupuesto.</p>
        <Link to="/presupuestos" className="text-sm font-medium underline">
          Volver a tus presupuestos
        </Link>
      </div>
    );
  }
  if (!project) return <p className="text-sm text-mid-gray">Cargando...</p>;

  const assets = project.items.filter((item) => item.type === "Asset");
  const liabilities = project.items.filter((item) => item.type === "Liability");
  const assetCount = assets.length;
  const quotedCount = assets.filter((item) => item.quote || item.aiQuoteSummary).length;
  const sum = (items: BudgetItemDto[]) => items.reduce((total, item) => total + item.estimatedAmount, 0);

  return (
    <div>
      <Link to="/presupuestos" className="inline-flex items-center gap-1 text-xs font-medium text-mid-gray hover:text-ink">
        <ArrowLeft size={14} aria-hidden="true" />
        Tus presupuestos
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-2">
        <PageTitle title={project.name} subtitle="Revisa los tipos antes de generar: solo se cotizan los activos." />
        <div className="flex flex-wrap gap-2 mb-6">
          <Button onClick={generate} disabled={quoting || changingType || assetCount === 0}>
            <Sparkles size={16} aria-hidden="true" />
            {quoting ? "Generando..." : "Generar presupuesto actualizado"}
          </Button>
          <Button variant="secondary" onClick={download} disabled={quoting || downloading}>
            <Download size={16} aria-hidden="true" />
            {downloading ? "Descargando..." : "Descargar Excel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Activos estimados" value={clp.format(sum(assets))} detail={`${assetCount} ${assetCount === 1 ? "ítem" : "ítems"} para cotizar`} />
        <Stat
          label="Pasivos"
          value={clp.format(sum(liabilities))}
          detail={`${liabilities.length} ${liabilities.length === 1 ? "ítem" : "ítems"}, solo se clasifican`}
        />
        <Stat
          label="Activos cotizados"
          value={`${quotedCount} de ${assetCount}`}
          detail={quotedCount === assetCount && assetCount > 0 ? "Listo para descargar" : "Aprieta Generar para cotizar"}
          highlighted
        />
      </div>

      {progress && (
        <div className="mb-4" aria-live="polite">
          <div className="text-sm mb-1">
            Cotizando {progress.done} de {progress.total}. No cierres esta página.
          </div>
          <ProgressBar percent={(progress.done / Math.max(progress.total, 1)) * 100} color="green" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-ember mb-4">
          {error}
        </p>
      )}

      <GroupTitle label="Activos" count={assets.length} dotClass="bg-brand" />
      {assets.length === 0 ? (
        <EmptyGroup text="No hay activos en esta planilla, así que no hay nada que cotizar." />
      ) : (
        <Card className="!p-0 overflow-x-auto mb-8">
          <table className="w-full min-w-[1100px] text-sm text-left">
            <thead className="text-xs text-mid-gray">
              <tr className="border-b border-hairline">
                <HeaderCell rowSpan={2}>Nombre</HeaderCell>
                <HeaderCell rowSpan={2}>Categoría</HeaderCell>
                <HeaderCell rowSpan={2}>Tipo</HeaderCell>
                <HeaderCell rowSpan={2}>Monto estimado</HeaderCell>
                <HeaderCell colSpan={3} center quote>
                  Cotización Nueva
                </HeaderCell>
                <HeaderCell rowSpan={2}>Fuentes consultadas</HeaderCell>
                <HeaderCell rowSpan={2}>Fecha de cotización</HeaderCell>
              </tr>
              <tr className="border-b border-hairline">
                <HeaderCell quote>Rango de precio</HeaderCell>
                <HeaderCell quote>Mejor precio-calidad</HeaderCell>
                <HeaderCell quote>Proveedores</HeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-hairline align-top">
              {assets.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  typeDisabled={quoting || changingType}
                  onTypeChange={(type) => changeType(item, type)}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <GroupTitle label="Pasivos" count={liabilities.length} dotClass="bg-[#c4c2e0]" />
      {liabilities.length === 0 ? (
        <EmptyGroup text="No hay pasivos en esta planilla." />
      ) : (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm text-left">
            <thead className="text-xs text-mid-gray">
              <tr className="border-b border-hairline">
                <HeaderCell>Nombre</HeaderCell>
                <HeaderCell>Categoría</HeaderCell>
                <HeaderCell>Tipo</HeaderCell>
                <HeaderCell>Monto estimado</HeaderCell>
                <HeaderCell>Cotización</HeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-hairline align-top">
              {liabilities.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  typeDisabled={quoting || changingType}
                  onTypeChange={(type) => changeType(item, type)}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, detail, highlighted }: { label: string; value: string; detail: string; highlighted?: boolean }) {
  return (
    <div className={`rounded-[18px] px-4 py-3.5 ${highlighted ? "bg-highlight" : "bg-paper border border-hairline"}`}>
      <div className={`text-xs font-semibold ${highlighted ? "text-ink" : "text-mid-gray"}`}>{label}</div>
      <div className="font-display text-[26px] font-extrabold tracking-tight tabular-nums mt-0.5">{value}</div>
      <div className={`text-xs mt-0.5 ${highlighted ? "text-ink" : "text-mid-gray"}`}>{detail}</div>
    </div>
  );
}

function GroupTitle({ label, count, dotClass }: { label: string; count: number; dotClass: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-extrabold mb-3">
      <span className={`h-3 w-3 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
      <span className="font-sans text-sm font-medium text-mid-gray">
        {count} {count === 1 ? "ítem" : "ítems"}
      </span>
    </h2>
  );
}

function EmptyGroup({ text }: { text: string }) {
  return <p className="text-sm text-mid-gray mb-8">{text}</p>;
}

function HeaderCell({
  children,
  rowSpan,
  colSpan,
  center,
  quote,
}: {
  children: React.ReactNode;
  rowSpan?: number;
  colSpan?: number;
  center?: boolean;
  quote?: boolean;
}) {
  return (
    <th
      scope="col"
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`px-3 py-2.5 font-semibold ${center ? "text-center" : ""} ${quote ? "text-brand bg-brand-soft/60" : ""}`}
    >
      {children}
    </th>
  );
}

function ItemRow({
  item,
  typeDisabled,
  onTypeChange,
}: {
  item: BudgetItemDto;
  typeDisabled: boolean;
  onTypeChange: (type: BudgetItemType) => void;
}) {
  const isAsset = item.type === "Asset";
  const muted = !item.quote && !item.aiQuoteSummary;
  const quoteCell = `px-3 py-3 bg-brand-soft/25 ${muted ? "text-mid-gray" : ""}`;

  return (
    <tr>
      <td className="px-3 py-3 font-semibold">{item.name}</td>
      <td className="px-3 py-3">{item.category}</td>
      <td className="px-3 py-2.5 w-28">
        <Select
          aria-label={`Tipo de ${item.name}`}
          value={item.type}
          disabled={typeDisabled}
          onChange={(e) => onTypeChange(e.target.value as BudgetItemType)}
          className="!py-1 !px-2 text-xs disabled:opacity-60"
        >
          <option value="Asset">Activo</option>
          <option value="Liability">Pasivo</option>
        </Select>
      </td>
      <td className="px-3 py-3 whitespace-nowrap tabular-nums">{clp.format(item.estimatedAmount)}</td>
      {isAsset ? (
        <>
          <td className={`${quoteCell} border-l-2 border-dotted border-brand/40`}>
            <span className={muted ? "" : "font-display text-[15px] font-bold tabular-nums"}>
              {item.quote?.priceRange ?? item.aiQuoteSummary ?? NOT_QUOTED_YET}
            </span>
          </td>
          <td className={quoteCell}>
            {item.quote?.bestValue ? (
              <>
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-highlight px-2 py-0.5 text-[11px] font-bold text-ink">
                  <Star size={11} className="fill-current" aria-hidden="true" />
                  Mejor opción
                </span>
                <span className="block font-medium">{item.quote.bestValue}</span>
              </>
            ) : (
              NOT_QUOTED_YET
            )}
          </td>
          <td className={quoteCell}>{item.quote?.suppliers ?? NOT_QUOTED_YET}</td>
          <td className="px-3 py-3 text-xs text-mid-gray">{item.quote?.sources}</td>
          <td className="px-3 py-3 whitespace-nowrap">
            {item.aiQuotedAt && new Date(item.aiQuotedAt).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}
          </td>
        </>
      ) : (
        <td className="px-3 py-3 text-mid-gray">{NOT_QUOTABLE}: solo se clasifica.</td>
      )}
    </tr>
  );
}
