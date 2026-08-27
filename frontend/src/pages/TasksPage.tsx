import { useEffect, useState } from "react";
import * as tasksApi from "../api/tasks";
import * as categoriesApi from "../api/categories";
import type { Category, DeadlineScope, TaskItemDto } from "../api/types";
import { Button, Card, ColorDot, Input, Modal, PageTitle, Select } from "../components/ui";

const scopes: { value: DeadlineScope; label: string }[] = [
  { value: "Today", label: "Para hoy" },
  { value: "Week", label: "Esta semana" },
  { value: "Month", label: "Este mes" },
];

export default function TasksPage() {
  const [scope, setScope] = useState<DeadlineScope>("Today");
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const load = async (s: DeadlineScope) => {
    const [list, cats] = await Promise.all([
      tasksApi.getTasks({ scope: s, kind: "Task" }),
      categoriesApi.getCategories("Task"),
    ]);
    setTasks(list);
    setCategories(cats);
  };

  useEffect(() => {
    load(scope);
  }, [scope]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueAt("");
    setCategoryId("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await tasksApi.createTask({
      title: title.trim(),
      description: description.trim() || null,
      kind: "Task",
      deadlineScope: scope,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      isRepetitive: false,
      repeatDays: "None",
      categoryId: categoryId || null,
    });
    resetForm();
    setModalOpen(false);
    load(scope);
  };

  const toggleTask = async (id: string) => {
    await tasksApi.toggleTaskComplete(id);
    load(scope);
  };

  const removeTask = async (id: string) => {
    await tasksApi.deleteTask(id);
    load(scope);
  };

  return (
    <div>
      <PageTitle title="Tareas" subtitle="Organiza tus pendientes por plazo: hoy, esta semana o este mes." />

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {scopes.map((s) => (
            <button
              key={s.value}
              onClick={() => setScope(s.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                scope === s.value ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Nueva tarea</Button>
      </div>

      <Card>
        {tasks.length === 0 && <p className="text-sm text-slate-400">No hay tareas en este plazo.</p>}
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <li key={t.id} className="py-3 flex items-center gap-3">
              <input type="checkbox" checked={t.isCompleted} onChange={() => toggleTask(t.id)} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${t.isCompleted ? "line-through text-slate-400" : "text-slate-800"}`}>
                  {t.title}
                </div>
                {t.description && <div className="text-xs text-slate-500 truncate">{t.description}</div>}
                {t.dueAt && (
                  <div className="text-xs text-slate-400">
                    ⏰ {new Date(t.dueAt).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                )}
              </div>
              {t.categoryColor && <ColorDot color={t.categoryColor} />}
              <button onClick={() => removeTask(t.id)} className="text-slate-300 hover:text-red-500 text-sm">
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva tarea">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <label className="text-xs text-slate-500">Recordatorio con fecha y hora exacta (opcional)</label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button type="submit" className="w-full">
            Guardar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
