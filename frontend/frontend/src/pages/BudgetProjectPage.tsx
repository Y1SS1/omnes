import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

  const assetCount = project.items.filter((item) => item.type === "Asset").length;

  return (
    <div>
      <Link to="/presupuestos" className="text-xs text-mid-gray hover:text-ink">
        ← Tus presupuestos
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
        <PageTitle title={project.name} subtitle="Revisa los tipos antes de generar: solo se cotizan los activos." />
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={quoting || changingType || assetCount === 0}>
            {quoting ? "Generando..." : "Generar presupuesto actualizado"}
          </Button>
          <Button variant="secondary" onClick={download} disabled={quoting || downloading}>
            {downloading ? "Descargando..." : "Descargar Excel"}
          </Button>
        </div>
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

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm text-left">
          <thead className="text-xs text-mid-gray bg-surface-alt">
            <tr className="border-b border-hairline">
              <HeaderCell rowSpan={2}>Nombre</HeaderCell>
              <HeaderCell rowSpan={2}>Categoría</HeaderCell>
              <HeaderCell rowSpan={2}>Tipo</HeaderCell>
              <HeaderCell rowSpan={2}>Monto estimado</HeaderCell>
              <HeaderCell colSpan={3} center>Cotización Nueva</HeaderCell>
              <HeaderCell rowSpan={2}>Fuentes consultadas</HeaderCell>
              <HeaderCell rowSpan={2}>Fecha de cotización</HeaderCell>
            </tr>
            <tr className="border-b border-hairline">
              <HeaderCell>Rango de precio</HeaderCell>
              <HeaderCell>Mejor precio-calidad</HeaderCell>
              <HeaderCell>Proveedores</HeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline align-top">
            {project.items.map((item) => (
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
    </div>
  );
}

function HeaderCell({ children, rowSpan, colSpan, center }: { children: React.ReactNode; rowSpan?: number; colSpan?: number; center?: boolean }) {
  return (
    <th scope="col" rowSpan={rowSpan} colSpan={colSpan} className={`px-3 py-2 font-medium ${center ? "text-center" : ""}`}>
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
  const placeholder = item.type === "Asset" ? NOT_QUOTED_YET : NOT_QUOTABLE;
  const muted = !item.quote && !item.aiQuoteSummary;
  const cellClass = `px-3 py-2.5 ${muted ? "text-mid-gray" : ""}`;

  return (
    <tr>
      <td className="px-3 py-2.5 font-medium">{item.name}</td>
      <td className="px-3 py-2.5">{item.category}</td>
      <td className="px-3 py-2 w-28">
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
      <td className="px-3 py-2.5 whitespace-nowrap">{clp.format(item.estimatedAmount)}</td>
      <td className={cellClass}>{item.quote?.priceRange ?? item.aiQuoteSummary ?? placeholder}</td>
      <td className={cellClass}>{item.quote?.bestValue ?? placeholder}</td>
      <td className={cellClass}>{item.quote?.suppliers ?? placeholder}</td>
      <td className="px-3 py-2.5 text-xs text-mid-gray">{item.quote?.sources}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {item.aiQuotedAt && new Date(item.aiQuotedAt).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}
      </td>
    </tr>
  );
}
