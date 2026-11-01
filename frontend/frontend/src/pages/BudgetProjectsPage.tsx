import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as budgetProjectsApi from "../api/budgetProjects";
import type { BudgetProjectSummaryDto } from "../api/types";
import { Button, Card, Input, PageTitle } from "../components/ui";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function fileProblem(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return "El archivo debe estar en formato .xlsx.";
  if (file.size > MAX_FILE_BYTES) return "El archivo no puede superar los 5 MB.";
  return null;
}

export default function BudgetProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<BudgetProjectSummaryDto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    budgetProjectsApi.getProjects().then(setProjects).catch(() => setLoadFailed(true));
  }, []);

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
      navigate(`/presupuestos/${project.id}`);
    } catch (err) {
      setError(budgetProjectsApi.apiErrorMessage(err, "No se pudo subir la planilla. Vuelve a adjuntarla e intenta de nuevo."));
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageTitle title="Presupuestos" subtitle="Sube tu planilla y la IA separará tus activos y pasivos." />

      <Card className="mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            className={`block rounded-[18px] border-2 border-dashed p-6 text-center transition-colors focus-within:border-ink ${
              uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${dragging ? "border-ink bg-canvas" : "border-hairline hover:border-neutral-400"}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => chooseFile(e.target.files?.[0])}
            />
            <div className="text-2xl mb-1" aria-hidden="true">📎</div>
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
            <p role="alert" className="text-sm text-ember whitespace-pre-line">
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

      <Card>
        <h2 className="font-semibold mb-3">Tus presupuestos</h2>
        {loadFailed && <p className="text-sm text-ember">No se pudieron cargar tus presupuestos.</p>}
        {projects?.length === 0 && <p className="text-sm text-mid-gray">Todavía no has subido ninguna planilla.</p>}
        <div className="divide-y divide-hairline">
          {projects?.map((project) => (
            <Link
              key={project.id}
              to={`/presupuestos/${project.id}`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-mid-gray"
            >
              <span className="font-medium truncate">{project.name}</span>
              <span className="text-xs text-mid-gray shrink-0">
                {project.itemCount} {project.itemCount === 1 ? "ítem" : "ítems"} ·{" "}
                {new Date(project.createdAt).toLocaleDateString("es-CL")}
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
