import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChartLine, Check, CircleCheck, Download, RefreshCw, Sparkles, Star, Wallet, X } from "lucide-react";
import * as budgetProjectsApi from "../api/budgetProjects";
import * as plannedItemsApi from "../api/plannedItems";
import type { BudgetItemDto, BudgetItemType, BudgetProjectDto } from "../api/types";
import { Button, Card, PageTitle, ProgressBar } from "../components/ui";
import { Select } from "../components/Select";
import { ITEM_TYPE_OPTIONS } from "../components/itemTypeOptions";
import { buttonClass } from "../components/buttonClass";
import { BudgetReviewPanel, type ReviewRun } from "../components/BudgetReviewPanel";
import { ReviewSearchBar } from "../components/ReviewSearchBar";
import { useConfirm } from "../components/useConfirm";

const QUOTES_AT_ONCE = 5;
const MAX_ITEMS = 50;
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
  const { confirm, confirmDialog } = useConfirm();
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // Set by the page that just created this budget, so the first visit says what to do next.
  const [createdFrom, setCreatedFrom] = useState<"ai" | "excel" | null>(() => {
    const created = (location.state as { created?: unknown } | null)?.created;
    return created === "ai" || created === "excel" ? created : null;
  });
  const [project, setProject] = useState<BudgetProjectDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [changingType, setChangingType] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The budget the wallet holds right now (only one at a time), if any.
  const [walletProject, setWalletProject] = useState<{ id: string; name: string } | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferred, setTransferred] = useState(false);
  // How many assets the last "Generar" run quoted, to confirm the result and point to the next step.
  const [quoteDone, setQuoteDone] = useState<number | null>(null);
  // "¿Qué me falta?": the current AI review, and how many of its suggestions were just added.
  const [review, setReview] = useState<ReviewRun | null>(null);
  const reviewId = useRef(0);
  // The search bar the "¿Qué me falta?" button turns into, and what is typed in it.
  const [searchOpen, setSearchOpen] = useState(false);
  const [reviewGoal, setReviewGoal] = useState("");
  const [addedCount, setAddedCount] = useState<number | null>(null);
  // Rows that changed during this visit, so only they animate (not every row on page load).
  const [justQuoted, setJustQuoted] = useState<ReadonlySet<string>>(new Set());
  const [justAdded, setJustAdded] = useState<ReadonlySet<string>>(new Set());

  // Shown once: drop the flag from the history entry so a reload does not repeat the notice.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const leftPage = useRef(false);

  const quoting = progress !== null;

  useEffect(() => {
    budgetProjectsApi.getProject(id).then(setProject).catch(() => setNotFound(true));
    plannedItemsApi
      .getPlannedItems()
      .then((items) => setWalletProject(items[0] ? { id: items[0].budgetProjectId, name: items[0].budgetProjectName } : null))
      .catch(() => setWalletProject(null));
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

  // "missing" quotes only the assets without a price (the usual case, e.g. after adding
  // suggestions); "all" refreshes every price. Quotes made today are never charged again.
  const generate = async (scope: "missing" | "all") => {
    if (!project) return;
    const queue = project.items
      .filter((item) => item.type === "Asset" && (scope === "all" || !(item.quote || item.aiQuoteSummary)))
      .map((item) => item.id);
    const total = queue.length;
    let done = 0;
    let failed = 0;
    let blockedBy: string | null = null;

    setError(null);
    setQuoteDone(null);
    setCreatedFrom(null);
    setProgress({ done, total });

    const worker = async () => {
      while (queue.length > 0 && blockedBy === null && !leftPage.current) {
        const itemId = queue.shift()!;
        try {
          const updated = await quoteWithRetry(project.id, itemId);
          setProject((current) =>
            current && { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) }
          );
          setJustQuoted((current) => new Set(current).add(updated.id));
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
    } else if (!leftPage.current && total > 0) {
      setQuoteDone(total);
    }
  };

  // Started on submit (not from an effect) so a review is never requested twice.
  const startReview = async () => {
    if (!project) return;
    const runId = ++reviewId.current;
    const goal = reviewGoal.trim();
    setReview({ id: runId, goal, loading: true, result: null, error: null });
    setAddedCount(null);
    setError(null);
    try {
      const result = await budgetProjectsApi.reviewProject(project.id, goal);
      if (runId === reviewId.current) setReview({ id: runId, goal, loading: false, result, error: null });
    } catch (err) {
      if (runId === reviewId.current)
        setReview({
          id: runId,
          goal,
          loading: false,
          result: null,
          error: budgetProjectsApi.apiErrorMessage(err, "No se pudo revisar el presupuesto con IA. Intenta de nuevo."),
        });
    }
  };

  // Closes the bar and its suggestions; a late answer is ignored.
  const closeReview = () => {
    reviewId.current++;
    setReview(null);
    setSearchOpen(false);
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

  const sendToWallet = async () => {
    if (!project) return;
    const message = !walletProject
      ? null
      : walletProject.id === project.id
        ? "Este presupuesto ya está en tu billetera. Si lo vuelves a pasar, se reemplazan sus ítems, incluidos los cambios que hiciste en la billetera."
        : `Tu billetera tiene el presupuesto "${walletProject.name}". Esto lo reemplaza por "${project.name}".`;
    if (
      message &&
      !(await confirm({ title: "¿Reemplazar lo que hay en tu billetera?", message, confirmLabel: "Reemplazar", danger: true }))
    )
      return;
    setTransferring(true);
    setTransferred(false);
    setError(null);
    try {
      await plannedItemsApi.transferFromProject(project.id);
      setWalletProject({ id: project.id, name: project.name });
      setTransferred(true);
    } catch (err) {
      setError(budgetProjectsApi.apiErrorMessage(err, "No se pudo pasar a la billetera. Intenta de nuevo."));
    } finally {
      setTransferring(false);
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
        <Link to="/" className="text-sm font-medium underline">
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
  const inWallet = walletProject?.id === project.id;
  // Where the user is in the path: 1 quote the assets, 2 send to the wallet, 3 see the reports.
  const allQuoted = assetCount === 0 || quotedCount === assetCount;
  const step: Step = !allQuoted ? 1 : !inWallet ? 2 : 3;
  const reportsUrl = `/reports?presupuesto=${project.id}`;
  const sum = (items: BudgetItemDto[]) => items.reduce((total, item) => total + item.estimatedAmount, 0);

  // Every asset is searched on the web again, so the cost is spelled out first.
  const refreshAll = async () => {
    const ok = await confirm({
      title: "¿Actualizar todos los precios?",
      message: `Se vuelven a buscar en internet los precios de ${
        assetCount === 1 ? "1 activo" : `los ${assetCount} activos`
      }. Lo cotizado hoy no se cobra de nuevo.`,
      confirmLabel: "Actualizar precios",
    });
    if (ok) await generate("all");
  };

  return (
    <div>
      {confirmDialog}
      <Link to="/" className="inline-flex items-center gap-1 text-xs font-medium text-mid-gray hover:text-ink">
        <ArrowLeft size={14} aria-hidden="true" />
        Tus presupuestos
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-2">
        <PageTitle
          title={project.name}
          subtitle={
            step === 1
              ? "Revisa los tipos y cotiza: solo se cotizan los activos."
              : "Cotización lista: pásala a tu billetera para ejecutarla o mira sus reportes."
          }
        />
        <div className="flex flex-wrap gap-2 mb-6">
          {/* The button of the step the user is on is the primary one. */}
          {allQuoted && quotedCount > 0 ? (
            <Button variant="secondary" onClick={refreshAll} disabled={quoting || changingType}>
              <RefreshCw size={16} aria-hidden="true" />
              {quoting ? "Actualizando..." : "Actualizar todos los precios"}
            </Button>
          ) : (
            <Button
              variant={step === 1 ? "primary" : "secondary"}
              onClick={() => generate("missing")}
              disabled={quoting || changingType || assetCount === 0}
            >
              <Sparkles size={16} aria-hidden="true" />
              {quoting ? "Generando..." : "Generar presupuesto actualizado"}
            </Button>
          )}
          <ReviewSearchBar
            open={searchOpen}
            goal={reviewGoal}
            loading={review?.loading ?? false}
            disabled={quoting || changingType || project.items.length >= MAX_ITEMS}
            onOpen={() => {
              setSearchOpen(true);
              setAddedCount(null);
            }}
            onGoalChange={setReviewGoal}
            onSubmit={startReview}
            onClose={closeReview}
          />
          <Button
            variant={step === 2 ? "primary" : "secondary"}
            onClick={sendToWallet}
            disabled={quoting || transferring || changingType}
          >
            <Wallet size={16} aria-hidden="true" />
            {transferring ? "Pasando..." : inWallet ? "Actualizar en la billetera" : "Pasar a la billetera"}
          </Button>
          {quotedCount > 0 && (
            <Link to={reportsUrl} className={buttonClass(step === 3 ? "primary" : "secondary")}>
              <ChartLine size={16} aria-hidden="true" />
              Ver reportes
            </Link>
          )}
          <Button variant="secondary" onClick={download} disabled={quoting || downloading}>
            <Download size={16} aria-hidden="true" />
            {downloading ? "Descargando..." : "Descargar Excel"}
          </Button>
        </div>
      </div>

      <Steps step={step} />

      {review && (
        <BudgetReviewPanel
          key={`${review.id}-${review.loading ? "loading" : "done"}`}
          run={review}
          projectId={project.id}
          inWallet={inWallet}
          onClose={closeReview}
          onAdded={(updated, count) => {
            const before = new Set(project.items.map((item) => item.id));
            setJustAdded(new Set(updated.items.filter((item) => !before.has(item.id)).map((item) => item.id)));
            setProject(updated);
            closeReview();
            setQuoteDone(null);
            setAddedCount(count);
          }}
        />
      )}

      {addedCount !== null && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[14px] border border-mint/40 bg-mint/10 px-4 py-3 text-sm motion-safe:animate-panel-in">
          <CircleCheck size={18} className="mt-px shrink-0 text-mint" aria-hidden="true" />
          <p className="flex-1">
            <span className="font-semibold">
              Listo: {addedCount === 1 ? "se agregó 1 ítem" : `se agregaron ${addedCount} ítems`}
              {inWallet ? ", también en tu billetera" : ""}.
            </span>{" "}
            {allQuoted
              ? "Los pasivos no se cotizan, así que no hay nada más que hacer."
              : "Los activos nuevos quedan sin cotizar: \"Generar presupuesto actualizado\" cotiza solo esos, sin volver a cobrar lo que ya tiene precio."}
          </p>
          <button
            type="button"
            onClick={() => setAddedCount(null)}
            className="shrink-0 rounded-full p-1 text-mid-gray hover:text-ink"
            aria-label="Cerrar aviso"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {quoteDone !== null && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[14px] border border-mint/40 bg-mint/10 px-4 py-3 text-sm motion-safe:animate-panel-in">
          <CircleCheck size={18} className="mt-px shrink-0 text-mint" aria-hidden="true" />
          <p className="flex-1">
            <span className="font-semibold">
              Listo: {quoteDone === 1 ? "se cotizó 1 activo" : `se cotizaron ${quoteDone} activos`}; todos los activos tienen precio.
            </span>{" "}
            {inWallet ? "Ya está en tu billetera: " : "Siguiente paso: pásalo a tu billetera para ejecutarlo, o "}
            <Link to={reportsUrl} className="font-semibold text-accent hover:underline">
              mira sus reportes
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={() => setQuoteDone(null)}
            className="shrink-0 rounded-full p-1 text-mid-gray hover:text-ink"
            aria-label="Cerrar aviso"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {createdFrom && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-[14px] border border-mint/40 bg-mint/10 px-4 py-3 text-sm motion-safe:animate-panel-in">
          <CircleCheck size={18} className="mt-px shrink-0 text-mint" aria-hidden="true" />
          <p className="flex-1">
            <span className="font-semibold">
              {createdFrom === "ai" ? "Presupuesto creado con IA." : "Presupuesto creado desde tu planilla."}
            </span>{" "}
            Siguiente paso: aprieta "Generar presupuesto actualizado" para cotizar los activos en internet.
          </p>
          <button
            type="button"
            onClick={() => setCreatedFrom(null)}
            className="shrink-0 rounded-full p-1 text-mid-gray hover:text-ink"
            aria-label="Cerrar aviso"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {transferred && (
        <p role="status" className="text-sm mb-4 rounded-[14px] border border-mint/40 bg-mint/10 px-4 py-3 motion-safe:animate-panel-in">
          <span className="font-semibold">Listo, este presupuesto está en tu billetera.</span>{" "}
          <Link to="/wallet" className="font-semibold text-accent hover:underline">
            Ver en la billetera
          </Link>
          {quotedCount > 0 && (
            <>
              {" · "}
              <Link to={reportsUrl} className="font-semibold text-accent hover:underline">
                Ver reportes
              </Link>
            </>
          )}
        </p>
      )}

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
        <div className="mb-4 motion-safe:animate-panel-in" aria-live="polite">
          <div className="text-sm mb-1">
            Cotizando {progress.done} de {progress.total}. No cierres esta página.
          </div>
          <ProgressBar percent={(progress.done / Math.max(progress.total, 1)) * 100} color="green" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-ember mb-4 motion-safe:animate-panel-in">
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
                  justQuoted={justQuoted.has(item.id)}
                  justAdded={justAdded.has(item.id)}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <GroupTitle label="Pasivos" count={liabilities.length} dotClass="bg-mid-gray" />
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
                  justQuoted={justQuoted.has(item.id)}
                  justAdded={justAdded.has(item.id)}
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
    <div className={`rounded-[18px] px-4 py-3.5 ${highlighted ? "bg-highlight text-on-highlight" : "bg-paper border border-hairline"}`}>
      <div className={`text-xs font-semibold ${highlighted ? "text-on-highlight" : "text-mid-gray"}`}>{label}</div>
      <div className="font-display text-[26px] font-extrabold tracking-tight tabular-nums mt-0.5">{value}</div>
      <div className={`text-xs mt-0.5 ${highlighted ? "text-on-highlight" : "text-mid-gray"}`}>{detail}</div>
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
      className={`px-3 py-2.5 font-semibold ${center ? "text-center" : ""} ${quote ? "text-accent bg-surface-alt" : ""}`}
    >
      {children}
    </th>
  );
}

function ItemRow({
  item,
  typeDisabled,
  onTypeChange,
  justQuoted,
  justAdded,
}: {
  item: BudgetItemDto;
  typeDisabled: boolean;
  onTypeChange: (type: BudgetItemType) => void;
  justQuoted: boolean;
  justAdded: boolean;
}) {
  const isAsset = item.type === "Asset";
  const muted = !item.quote && !item.aiQuoteSummary;
  // A quote that just arrived fades in from soft orange, cell by cell.
  const arrived = justQuoted ? "motion-safe:animate-quote-in" : "";
  const quoteCell = `px-3 py-3 bg-surface-alt/60 ${muted ? "text-mid-gray" : ""} ${arrived}`;

  return (
    <tr className={justAdded ? "motion-safe:animate-row-in" : undefined}>
      <td className="px-3 py-3 font-semibold">{item.name}</td>
      <td className="px-3 py-3">{item.category}</td>
      <td className="px-3 py-2.5 w-28">
        <Select
          aria-label={`Tipo de ${item.name}`}
          value={item.type}
          options={ITEM_TYPE_OPTIONS}
          disabled={typeDisabled}
          onChange={onTypeChange}
          size="sm"
        />
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
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-on-brand">
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
          <td className={`px-3 py-3 text-xs text-mid-gray ${arrived}`}>{item.quote?.sources}</td>
          <td className={`px-3 py-3 whitespace-nowrap ${arrived}`}>
            {item.aiQuotedAt && new Date(item.aiQuotedAt).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}
          </td>
        </>
      ) : (
        <td className="px-3 py-3 text-mid-gray">{NOT_QUOTABLE}: solo se clasifica.</td>
      )}
    </tr>
  );
}

type Step = 1 | 2 | 3;

const STEPS: { label: string; hint: string }[] = [
  { label: "Cotizar los activos", hint: 'Aprieta "Generar presupuesto actualizado": la IA busca el precio de cada activo en internet.' },
  { label: "Pasar a la billetera", hint: "Llévalo a tu billetera para ejecutarlo y ajustar sus montos." },
  { label: "Ver reportes", hint: "Compara tus montos estimados con los precios que encontró la IA." },
];

// The path of a budget, so the user always sees what is done and what comes next.
function Steps({ step }: { step: Step }) {
  return (
    <nav aria-label="Pasos del presupuesto" className="mb-5 rounded-[18px] border border-hairline bg-paper px-4 py-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {STEPS.map((s, index) => {
          const number = (index + 1) as Step;
          const done = number < step;
          const current = number === step;
          return (
            <li key={s.label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
              {index > 0 && <span className="h-px w-6 bg-hairline sm:w-10" aria-hidden="true" />}
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300 ${
                  done ? "bg-mint/20 text-mint" : current ? "bg-brand text-on-brand" : "bg-canvas text-mid-gray"
                }`}
                aria-hidden="true"
              >
                {done ? <Check size={14} /> : number}
              </span>
              <span
                className={`transition-colors duration-300 ${
                  current ? "font-semibold text-ink" : done ? "text-mid-gray line-through decoration-mid-gray/40" : "text-mid-gray"
                }`}
              >
                {s.label}
                {done && <span className="sr-only"> (hecho)</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {/* Keyed by step so the hint fades in again when the user moves to the next step. */}
      <p key={step} className="mt-2 text-xs text-mid-gray motion-safe:animate-fade-in">
        {STEPS[step - 1].hint}
      </p>
    </nav>
  );
}
