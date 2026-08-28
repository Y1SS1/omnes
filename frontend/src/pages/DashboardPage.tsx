import { useEffect, useState } from "react";
import * as tasksApi from "../api/tasks";
import * as walletApi from "../api/wallet";
import * as categoriesApi from "../api/categories";
import type { Category, DeadlineScope, TaskItemDto, TaskKind } from "../api/types";
import { Button, Card, ColorDot, Input, PageTitle, Select } from "../components/ui";
import { useCurrency } from "../context/CurrencyContext";

const kindLabels: Record<TaskKind, string> = { Task: "Por hacer", Note: "Nota general", DoneActivity: "Realizado" };

export default function DashboardPage() {
  const { formatMoney } = useCurrency();
  const [quickText, setQuickText] = useState("");
  const [quickKind, setQuickKind] = useState<TaskKind>("Task");
  const [saving, setSaving] = useState(false);

  const [todayTasks, setTodayTasks] = useState<TaskItemDto[]>([]);
  const [todayHabits, setTodayHabits] = useState<TaskItemDto[]>([]);
  const [doneActivities, setDoneActivities] = useState<TaskItemDto[]>([]);
  const [notes, setNotes] = useState<TaskItemDto[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = async () => {
    const [tasks, habits, allDone, allNotes, wallet, cats] = await Promise.all([
      tasksApi.getTasks({ scope: "Today", kind: "Task" }),
      tasksApi.getHabits(),
      tasksApi.getTasks({ kind: "DoneActivity" }),
      tasksApi.getTasks({ kind: "Note" }),
      walletApi.getWallet(),
      categoriesApi.getCategories("Task"),
    ]);
    setTodayTasks(tasks);
    setTodayHabits(habits);
    const todayStr = new Date().toDateString();
    setDoneActivities(allDone.filter((d) => d.completedAt && new Date(d.completedAt).toDateString() === todayStr));
    setNotes(allNotes.slice(0, 5));
    setBalance(wallet.balance);
    setCategories(cats);
  };

  useEffect(() => {
    load();
  }, []);

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    setSaving(true);
    try {
      const deadlineScope: DeadlineScope = quickKind === "Task" ? "Today" : "None";
      await tasksApi.createTask({
        title: quickText.trim(),
        kind: quickKind,
        deadlineScope,
        isRepetitive: false,
        repeatDays: "None",
      });
      setQuickText("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (id: string) => {
    await tasksApi.toggleTaskComplete(id);
    load();
  };

  const toggleHabit = async (id: string) => {
    await tasksApi.toggleHabit(id);
    load();
  };

  const removeDone = async (id: string) => {
    await tasksApi.deleteTask(id);
    load();
  };

  const categoryFor = (id: string | null) => categories.find((c) => c.id === id);

  return (
    <div>
      <PageTitle title="Centro personal" subtitle="Captura rápida de lo que sea: tarea, nota o gasto." />

      <Card className="mb-6">
        <form onSubmit={handleQuickCapture} className="flex flex-col sm:flex-row gap-3">
          <Input
            className="flex-1"
            placeholder="¿Qué necesitas registrar?"
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
          />
          <Select
            className="sm:w-48"
            value={quickKind}
            onChange={(e) => setQuickKind(e.target.value as TaskKind)}
          >
            <option value="Task">Por hacer</option>
            <option value="DoneActivity">Realizado</option>
            <option value="Note">Nota general</option>
          </Select>
          <Button type="submit" disabled={saving}>
            Agregar
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <h2 className="font-semibold mb-3">Para hoy</h2>
          {todayTasks.length === 0 && <p className="text-sm text-neutral-500">Nada pendiente para hoy.</p>}
          <ul className="space-y-2">
            {todayTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={t.isCompleted} onChange={() => toggleTask(t.id)} />
                <span className={t.isCompleted ? "line-through text-neutral-500" : ""}>{t.title}</span>
                {categoryFor(t.categoryId) && <ColorDot color={categoryFor(t.categoryId)!.color} />}
              </li>
            ))}
          </ul>

          {doneActivities.length > 0 && (
            <>
              <h3 className="text-xs font-medium text-neutral-500 mt-4 mb-2">Realizado hoy</h3>
              <ul className="space-y-2">
                {doneActivities.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-500">✓</span>
                    <span className="flex-1 min-w-0 truncate line-through text-neutral-500">{d.title}</span>
                    <button onClick={() => removeDone(d.id)} className="text-neutral-600 hover:text-red-500 text-xs">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Hábitos de hoy</h2>
          {todayHabits.length === 0 && <p className="text-sm text-neutral-500">No hay hábitos programados para hoy.</p>}
          <ul className="space-y-2">
            {todayHabits.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => toggleHabit(h.id)}
                  className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs ${
                    h.habitCheckedToday ? "bg-emerald-500 border-emerald-500 text-white" : "border-neutral-700"
                  }`}
                >
                  {h.habitCheckedToday ? "✓" : ""}
                </button>
                <span className={h.habitCheckedToday ? "line-through text-neutral-500" : ""}>{h.title}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Resumen</h2>
          <p className="text-sm text-neutral-400">Saldo disponible</p>
          <p className="text-3xl font-bold text-white mb-4">
            {balance !== null ? formatMoney(balance) : "—"}
          </p>
          <p className="text-sm text-neutral-400 mb-1">Últimas notas</p>
          <ul className="space-y-1 text-sm text-neutral-300">
            {notes.map((n) => (
              <li key={n.id} className="truncate">📌 {n.title}</li>
            ))}
            {notes.length === 0 && <li className="text-neutral-500">Sin notas todavía.</li>}
          </ul>
        </Card>
      </div>

      <p className="text-xs text-neutral-500 mt-6">Tipos disponibles: {Object.values(kindLabels).join(" · ")}</p>
    </div>
  );
}
