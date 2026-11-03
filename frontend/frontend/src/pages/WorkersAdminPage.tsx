import { useEffect, useState } from "react";
import * as workersApi from "../api/workers";
import type { WorkerDto } from "../api/workers";
import { Trash2 } from "lucide-react";
import { Avatar, Card, PageTitle, Button, Input } from "../components/ui";

interface Draft {
  displayName: string;
  email: string;
  jobTitle: string;
}

function toDraft(w: WorkerDto): Draft {
  return { displayName: w.displayName, email: w.email, jobTitle: w.jobTitle ?? "" };
}

function isDirty(draft: Draft, w: WorkerDto) {
  return draft.displayName !== w.displayName || draft.email !== w.email || draft.jobTitle !== (w.jobTitle ?? "");
}

export default function WorkersAdminPage() {
  const [workers, setWorkers] = useState<WorkerDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await workersApi.getWorkers();
    setWorkers(data);
    setDrafts(Object.fromEntries(data.map((w) => [w.id, toDraft(w)])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  const save = async (id: string) => {
    setError(null);
    setSavingId(id);
    try {
      const draft = drafts[id];
      const updated = await workersApi.updateWorker(id, draft.displayName.trim(), draft.email.trim(), draft.jobTitle.trim() || null);
      setWorkers((prev) => prev.map((w) => (w.id === id ? updated : w)));
      setDrafts((d) => ({ ...d, [id]: toDraft(updated) }));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: string } })?.response?.data;
      setError(typeof message === "string" && message ? message : "No se pudieron guardar los cambios.");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await workersApi.deleteWorker(id);
      setWorkers((prev) => prev.filter((w) => w.id !== id));
      setDrafts((d) => {
        const { [id]: _removed, ...rest } = d;
        return rest;
      });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div>
      <PageTitle title="Trabajadores" subtitle="Administra las cuentas de la empresa: nombre, correo y cargo." />

      {error && <p className="text-sm text-ember mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-mid-gray">Cargando...</p>
      ) : workers.length === 0 ? (
        <Card>
          <p className="text-sm text-mid-gray">
            Todavía no hay trabajadores registrados. Comparte el enlace de registro de trabajador para que se sumen.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {workers.map((w) => {
            const draft = drafts[w.id] ?? toDraft(w);
            return (
              <Card key={w.id} className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Avatar name={w.displayName} id={w.id} className="hidden sm:flex" />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                  <Input
                    placeholder="Nombre"
                    value={draft.displayName}
                    onChange={(e) => updateDraft(w.id, { displayName: e.target.value })}
                  />
                  <Input
                    type="email"
                    placeholder="Correo"
                    value={draft.email}
                    onChange={(e) => updateDraft(w.id, { email: e.target.value })}
                  />
                  <Input
                    placeholder="Cargo en la empresa"
                    value={draft.jobTitle}
                    onChange={(e) => updateDraft(w.id, { jobTitle: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={() => save(w.id)} disabled={savingId === w.id || !isDirty(draft, w)}>
                    {savingId === w.id ? "..." : "Guardar"}
                  </Button>
                  {confirmDeleteId === w.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-mid-gray">¿Eliminar?</span>
                      <Button variant="danger" onClick={() => remove(w.id)} disabled={deletingId === w.id}>
                        {deletingId === w.id ? "..." : "Sí"}
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        No
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(w.id)}
                      className="shrink-0 rounded-full p-2 text-mid-gray hover:bg-red-50 hover:text-ember"
                      aria-label={`Eliminar a ${w.displayName}`}
                      title="Eliminar trabajador"
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
