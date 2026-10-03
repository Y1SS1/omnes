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

// JS getDay(): 0=Sunday..6=Saturday, mapped to our day names.
const JS_DAY_TO_NAME: DayName[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const todayName = JS_DAY_TO_NAME[new Date().getDay()];

export default function HabitsPage() {
  const [habits, setHabits] = useState<TaskItemDto[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedDays, setSelectedDays] = useState<Set<DayName>>(new Set(ALL_DAYS));

  // Fetch every habit (not just today's) so ones scheduled for other days can still be seen/managed.
  const load = async () => setHabits(await tasksApi.getHabits(undefined, true));

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

  const isToday = (h: TaskItemDto) => h.repeatDays.includes(todayName);
  const todayHabits = habits.filter(isToday);
  const otherHabits = habits.filter((h) => !isToday(h));
  const pending = todayHabits.filter((h) => !h.habitCheckedToday);
  const done = todayHabits.filter((h) => h.habitCheckedToday);

  return (
    <div>
      <PageTitle title="Hábitos" subtitle="Actividades repetitivas: márcalas cada día y vuelven a aparecer mañana." />

      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>+ Nuevo hábito</Button>
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold mb-3">Hoy</h2>
        {todayHabits.length === 0 && <p className="text-sm text-mid-gray">No tienes hábitos programados para hoy.</p>}
        <ul className="space-y-2">
          {[...pending, ...done].map((h) => (
            <li key={h.id} className="flex items-center gap-3 py-1">
              <button
                onClick={() => toggleCheck(h.id)}
                className={`h-6 w-6 rounded-full border flex items-center justify-center text-sm shrink-0 ${
                  h.habitCheckedToday ? "bg-emerald-500 border-emerald-500 text-white" : "border-hairline"
                }`}
              >
                {h.habitCheckedToday ? "✓" : ""}
              </button>
              <span className={`text-sm flex-1 min-w-0 truncate ${h.habitCheckedToday ? "line-through text-mid-gray" : "text-ink"}`}>
                {h.title}
              </span>
              <span className="hidden md:inline text-[11px] text-mid-gray shrink-0 max-w-[10rem] truncate" title={h.repeatDays}>
                {h.repeatDays}
              </span>
              <button onClick={() => removeHabit(h.id)} className="text-mid-gray hover:text-red-500 text-sm">
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold mb-1">Todos tus hábitos</h2>
        <p className="text-xs text-mid-gray mb-3">
          Incluye los que no están programados para hoy — solo se pueden borrar aquí, no marcar.
        </p>
        {otherHabits.length === 0 ? (
          <p className="text-sm text-mid-gray">No tienes otros hábitos programados para otros días.</p>
        ) : (
          <ul className="space-y-2">
            {otherHabits.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-1">
                <span className="text-sm flex-1 min-w-0 truncate text-ink">{h.title}</span>
                <span className="text-[11px] text-mid-gray shrink-0 max-w-[12rem] truncate" title={h.repeatDays}>
                  {h.repeatDays}
                </span>
                <button onClick={() => removeHabit(h.id)} className="text-mid-gray hover:text-red-500 text-sm">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo hábito repetitivo">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input placeholder="Ej: Tomar medicamento" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div>
            <label className="text-xs text-mid-gray block mb-2">Días de la semana</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    selectedDays.has(day)
                      ? "bg-ink border-ink text-white"
                      : "border-hairline text-ink"
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
