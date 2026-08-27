import { useEffect, useState } from "react";
import * as tasksApi from "../api/tasks";
import { ALL_DAYS, type DayName, type TaskItemDto } from "../api/types";
import { Button, Card, Input, Modal, PageTitle } from "../components/ui";

const dayLabels: Record<DayName, string> = {
  Monday: "Lun",
  Tuesday: "Mar",
  Wednesday: "Mié",
  Thursday: "Jue",
  Friday: "Vie",
  Saturday: "Sáb",
  Sunday: "Dom",
};

export default function HabitsPage() {
  const [habits, setHabits] = useState<TaskItemDto[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedDays, setSelectedDays] = useState<Set<DayName>>(new Set(ALL_DAYS));

  const load = async () => setHabits(await tasksApi.getHabits());

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (day: DayName) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedDays.size === 0) return;
    await tasksApi.createTask({
      title: title.trim(),
      kind: "Task",
      deadlineScope: "None",
      isRepetitive: true,
      repeatDays: Array.from(selectedDays).join(", "),
    });
    setTitle("");
    setSelectedDays(new Set(ALL_DAYS));
    setModalOpen(false);
    load();
  };

  const toggleCheck = async (id: string) => {
    await tasksApi.toggleHabit(id);
    load();
  };

  const removeHabit = async (id: string) => {
    await tasksApi.deleteTask(id);
    load();
  };

  const pending = habits.filter((h) => !h.habitCheckedToday);
  const done = habits.filter((h) => h.habitCheckedToday);

  return (
    <div>
      <PageTitle title="Hábitos" subtitle="Actividades repetitivas: márcalas cada día y vuelven a aparecer mañana." />

      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>+ Nuevo hábito</Button>
      </div>

      <Card>
        {habits.length === 0 && <p className="text-sm text-neutral-500">No tienes hábitos programados para hoy.</p>}
        <ul className="space-y-2">
          {[...pending, ...done].map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-1">
              <button
                onClick={() => toggleCheck(h.id)}
                className={`h-6 w-6 rounded-full border flex items-center justify-center text-sm shrink-0 ${
                  h.habitCheckedToday ? "bg-emerald-500 border-emerald-500 text-white" : "border-neutral-700"
                }`}
              >
                {h.habitCheckedToday ? "✓" : ""}
              </button>
              <span className={`text-sm flex-1 min-w-0 truncate ${h.habitCheckedToday ? "line-through text-neutral-500" : "text-neutral-100"}`}>
                {h.title}
              </span>
              <span className="hidden md:inline text-[11px] text-neutral-500 shrink-0 max-w-[10rem] truncate" title={h.repeatDays}>
                {h.repeatDays}
              </span>
              <button onClick={() => removeHabit(h.id)} className="text-neutral-600 hover:text-red-500 text-sm">
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo hábito repetitivo">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input placeholder="Ej: Tomar medicamento" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div>
            <label className="text-xs text-neutral-400 block mb-2">Días de la semana</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    selectedDays.has(day)
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-neutral-700 text-neutral-300"
                  }`}
                >
                  {dayLabels[day]}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full">
            Guardar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
