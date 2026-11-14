import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, FileSpreadsheet, FolderOpen, Paperclip, Pencil, Sparkles, Trash2 } from "lucide-react";
import * as budgetProjectsApi from "../api/budgetProjects";
import * as plannedItemsApi from "../api/plannedItems";
import type { BudgetProjectSummaryDto } from "../api/types";
import { Button, Card, Input, Modal, PageTitle } from "../components/ui";
import { AiBudgetDraft } from "../components/AiBudgetDraft";
import { useConfirm } from "../components/useConfirm";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function fileProblem(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return "El archivo debe estar en formato .xlsx.";
  if (file.size > MAX_FILE_BYTES) return "El archivo no puede superar los 5 MB.";
  return null;
}

export default function BudgetProjectsPage() {
  const { confirm, confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<BudgetProjectSummaryDto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // How the new budget starts: an Excel the user uploads, or a description the AI turns into a list.
  const [mode, setMode] = useState<"excel" | "ai">("excel");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The budget the wallet holds, so deleting it can warn that the wallet copy goes too.
  const [walletProjectId, setWalletProjectId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<BudgetProjectSummaryDto | null>(null);
  const [newName, setNewName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // The options panel closes on Escape or on a click anywhere outside it.
  useEffect(() => {
    if (!menuFor) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  useEffect(() => {
    budgetProjectsApi
      .getProjects()
      .then(setProjects)
      .catch(() => setLoadFailed(true));
    plannedItemsApi
      .getPlannedItems()
      .then((items) => setWalletProjectId(items[0]?.budgetProjectId ?? null))
      .catch(() => setWalletProjectId(null));
  }, []);

  const openRename = (project: BudgetProjectSummaryDto) => {
    setMenuFor(null);
    setRenaming(project);
    setNewName(project.name);
    setRenameError(null);
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    setSavingName(true);
    setRenameError(null);
    try {
      const updated = await budgetProjectsApi.renameProject(renaming.id, newName.trim());
      setProjects((current) => current && current.map((p) => (p.id === updated.id ? updated : p)));
      setRenaming(null);
    } catch (err) {
      setRenameError(budgetProjectsApi.apiErrorMessage(err, "No se pudo cambiar el nombre. Intenta de nuevo."));
    } finally {
      setSavingName(false);
    }
  };

  const deleteProject = async (project: BudgetProjectSummaryDto) => {
    setMenuFor(null);
    const inWallet = project.id === walletProjectId;
    const ok = await confirm({
      title: "¿Borrar este presupuesto?",
      message: inWallet
        ? `Se borra "${project.name}". Es el presupuesto que tienes en tu billetera, así que también se quitará de ahí. No se puede deshacer.`
        : `Se borra "${project.name}". No se puede deshacer.`,
      confirmLabel: "Borrar",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(project.id);
    setListError(null);
    try {
      await budgetProjectsApi.deleteProject(project.id);
      setProjects((current) => current && current.filter((p) => p.id !== project.id));
      if (inWallet) setWalletProjectId(null);
    } catch (err) {
      setListError(budgetProjectsApi.apiErrorMessage(err, "No se pudo borrar el presupuesto. Intenta de nuevo."));
    } finally {
      setDeletingId(null);
    }
  };

  const chooseFile = (chosen: File | undefined) => {
    if (!chosen) return;
    const problem = fileProblem(chosen);
    setError(problem);
    setFile(problem ? null : chosen);
  };

  const removeFile = () => {
    setFile(null);
    // Otherwise the browser ignores choosing that same file again.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!uploading) chooseFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Adjunta tu planilla antes de subirla.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const project = await budgetProjectsApi.importProject(name.trim(), file);
      navigate(`/presupuestos/${project.id}`, { state: { created: "excel" } });
    } catch (err) {
      setError(budgetProjectsApi.apiErrorMessage(err, "No se pudo subir la planilla. Vuelve a adjuntarla e intenta de nuevo."));
      setUploading(false);
    }
  };

  const tabs = (
    <div role="tablist" aria-label="Cómo crear el presupuesto" className="mb-4 inline-flex rounded-full bg-canvas p-1">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "excel"}
        onClick={() => setMode("excel")}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          mode === "excel" ? "bg-paper text-ink shadow-sm" : "text-mid-gray hover:text-ink"
        }`}
      >
        <FileSpreadsheet size={15} aria-hidden="true" />
        Subir Excel
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "ai"}
        onClick={() => setMode("ai")}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          mode === "ai" ? "bg-paper text-ink shadow-sm" : "text-mid-gray hover:text-ink"
        }`}
      >
        <Sparkles size={15} aria-hidden="true" />
        Describir con IA
      </button>
    </div>
  );

  const history = (
    <Card className="lg:sticky lg:top-6">
      <h2 className="text-lg font-extrabold mb-2">
        Tus presupuestos
        {projects && projects.length > 0 && <span className="ml-2 text-sm font-medium text-mid-gray">{projects.length}</span>}
      </h2>
      {loadFailed && <p className="text-sm text-ember">No se pudieron cargar tus presupuestos.</p>}
      {projects?.length === 0 && <p className="text-sm text-mid-gray">Todavía no has subido ninguna planilla.</p>}
      {listError && (
        <p role="alert" className="text-sm text-ember mb-2 motion-safe:animate-panel-in">
          {listError}
        </p>
      )}
      {/* Its own scroll on wide screens, so a long history never stretches the page. */}
      <div className="divide-y divide-hairline lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:-mx-2 lg:px-2">
        {projects?.map((project) => {
          const open = menuFor === project.id;
          return (
            <div key={project.id} className="relative" ref={open ? menuRef : undefined}>
              <button
                type="button"
                onClick={() => setMenuFor(open ? null : project.id)}
                aria-haspopup="menu"
                aria-expanded={open}
                className={`group flex w-full items-center gap-3 -mx-2 px-2 py-3 rounded-[14px] text-left text-sm hover:bg-surface-alt ${
                  open ? "bg-surface-alt" : ""
                }`}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent"
                  aria-hidden="true"
                >
                  <FileSpreadsheet size={17} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold truncate">{project.name}</span>
                  <span className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <QuoteStatus quoted={project.quotedCount} assets={project.assetCount} />
                    {project.inWallet && <span className="rounded-full bg-highlight px-2 py-0.5 text-on-highlight">En la billetera</span>}
                  </span>
                </span>
                <span className="text-xs text-mid-gray shrink-0">
                  {project.itemCount} {project.itemCount === 1 ? "ítem" : "ítems"} ·{" "}
                  {new Date(project.createdAt).toLocaleDateString("es-CL")}
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-mid-gray transition-transform group-hover:text-accent ${open ? "rotate-180 text-accent" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {open && (
                <div
                  role="menu"
                  aria-label={`Opciones de ${project.name}`}
                  className="absolute right-0 top-full z-20 mt-1 w-56 rounded-[14px] border border-hairline bg-paper p-1.5 shadow-lg origin-top-right motion-safe:animate-pop-in"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate(`/presupuestos/${project.id}`)}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-ink hover:bg-brand-soft"
                  >
                    <FolderOpen size={16} className="text-accent" aria-hidden="true" />
                    Abrir presupuesto
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => openRename(project)}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-ink hover:bg-brand-soft"
                  >
                    <Pencil size={16} className="text-accent" aria-hidden="true" />
                    Cambiar nombre
                  </button>
                  <div className="my-1 border-t border-hairline" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => deleteProject(project)}
                    disabled={deletingId !== null}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-ember hover:bg-danger-soft disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Borrar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {confirmDialog}
      <PageTitle title="Presupuestos" subtitle="Sube tu planilla o describe tu proyecto, y la IA arma y cotiza tu presupuesto." />

      {/* Wide screens: create on the left, history on the right, so both fit on one screen.
          Narrow screens keep one column, creation first. "Describir con IA" lays out its own
          columns, because once the AI has a list, that list takes the history's place. */}
      {mode === "ai" ? (
        <AiBudgetDraft tabs={tabs} history={history} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Card>
            {tabs}
            <form onSubmit={handleSubmit} className="space-y-4 motion-safe:animate-fade-in">
              <div>
                <label htmlFor="budget-name" className="block text-sm font-medium mb-1">
                  Nombre del presupuesto
                </label>
                <Input
                  id="budget-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Local de pollos"
                  maxLength={200}
                  required
                  disabled={uploading}
                />
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`block rounded-[18px] border-2 border-dashed p-6 text-center transition-colors focus-within:border-brand ${
                  uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                } ${dragging ? "border-brand bg-brand-soft" : "border-hairline hover:border-brand/50 hover:bg-surface-alt"}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => chooseFile(e.target.files?.[0])}
                />
                <div
                  className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-highlight text-on-highlight"
                  aria-hidden="true"
                >
                  <Paperclip size={20} />
                </div>
                {file ? (
                  <div className="text-sm font-medium break-all">{file.name}</div>
                ) : (
                  <>
                    <div className="text-sm font-medium">
                      <span className="hidden md:inline">Arrastra tu planilla aquí o haz clic para adjuntarla</span>
                      <span className="md:hidden">Toca para adjuntar tu planilla</span>
                    </div>
                    <div className="text-xs text-mid-gray mt-1">Solo .xlsx, máximo 5 MB</div>
                  </>
                )}
              </label>

              {file && !uploading && (
                <button type="button" onClick={removeFile} className="text-xs text-mid-gray hover:text-ink">
                  Quitar archivo
                </button>
              )}

              <div className="text-xs text-mid-gray">
                <p>
                  Tu planilla debe tener estas columnas: <span className="text-ink font-medium">Nombre | Categoría | Monto estimado</span>
                </p>
                <p className="mt-1">Máximo 50 ítems. Usa nombres específicos, como "Servilletas, paquete de 100".</p>
              </div>

              {error && (
                <p role="alert" className="text-sm text-ember whitespace-pre-line motion-safe:animate-panel-in">
                  {error}
                </p>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Clasificando..." : "Subir planilla"}
                </Button>
              </div>
            </form>
          </Card>

          {history}
        </div>
      )}

      <Modal open={renaming !== null} onClose={() => setRenaming(null)} title="Cambiar nombre del presupuesto">
        <form onSubmit={saveName} className="space-y-3">
          <label htmlFor="rename-budget" className="block text-sm font-medium">
            Nombre
          </label>
          <Input id="rename-budget" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} required autoFocus />
          {renameError && <p className="text-sm text-ember">{renameError}</p>}
          <Button type="submit" className="w-full" disabled={savingName || newName.trim().length === 0}>
            {savingName ? "Guardando..." : "Guardar nombre"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

// How far quoting got, so the list says which budgets still need "Generar presupuesto actualizado".
function QuoteStatus({ quoted, assets }: { quoted: number; assets: number }) {
  if (assets === 0) return null;
  if (quoted === 0) return <span className="rounded-full bg-canvas px-2 py-0.5 text-mid-gray">Sin cotizar</span>;
  if (quoted < assets)
    return (
      <span className="rounded-full bg-canvas px-2 py-0.5 text-mid-gray">
        {quoted} de {assets} cotizados
      </span>
    );
  return <span className="rounded-full bg-mint/15 px-2 py-0.5 text-mint">Cotizado</span>;
}
