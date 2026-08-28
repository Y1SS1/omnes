import { useEffect, useMemo, useState } from "react";
import * as tasksApi from "../api/tasks";
import * as categoriesApi from "../api/categories";
import type { Category, TaskItemDto } from "../api/types";
import { Button, Card, CategoryLegend, ColorDot, Modal, PageTitle } from "../components/ui";

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [items, setItems] = useState<TaskItemDto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const load = () => tasksApi.getCalendar(year, month).then(setItems);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    categoriesApi.getCategories("Task").then(setCategories);
  }, []);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  };

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDay(null);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday=0
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: { day: number | null; items: TaskItemDto[] }[] = [];
    for (let i = 0; i < startWeekday; i++) result.push({ day: null, items: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const dayItems = items.filter((it) => it.dueAt && new Date(it.dueAt).getDate() === d);
      result.push({ day: d, items: dayItems });
    }
    return result;
  }, [items, year, month]);

  const selectedItems = selectedDay ? cells.find((c) => c.day === selectedDay)?.items ?? [] : [];

  const removeItem = async (id: string, isRepetitive: boolean) => {
    if (isRepetitive && !window.confirm("Este es un hábito repetitivo: borrarlo lo elimina de todos los días, no solo de hoy. ¿Continuar?")) {
      return;
    }
    await tasksApi.deleteTask(id);
    await load();
  };

  return (
    <div>
      <PageTitle title="Calendario" subtitle="Vista mensual de tus tareas y hábitos, codificados por color." />

      <div className="flex items-center justify-between mb-4 gap-2">
        <Button variant="secondary" onClick={() => changeMonth(-1)}>
          <span className="hidden sm:inline">← Anterior</span>
          <span className="sm:hidden">←</span>
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-base sm:text-lg text-center truncate">{monthNames[month - 1]} {year}</h2>
          {!isCurrentMonth && (
            <Button variant="ghost" onClick={goToToday} className="text-indigo-400">
              Hoy
            </Button>
          )}
        </div>
        <Button variant="secondary" onClick={() => changeMonth(1)}>
          <span className="hidden sm:inline">Siguiente →</span>
          <span className="sm:hidden">→</span>
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-[10px] sm:text-xs font-medium text-neutral-500 mb-2">
          {weekDayLabels.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {cells.map((cell, idx) => {
            const isToday = isCurrentMonth && cell.day === today.getDate();
            return (
              <button
                key={idx}
                type="button"
                disabled={!cell.day}
                onClick={() => cell.day && setSelectedDay(cell.day)}
                className={`min-h-14 sm:min-h-24 rounded-md sm:rounded-lg border p-0.5 sm:p-1.5 overflow-hidden text-left transition-colors ${
                  !cell.day
                    ? "bg-transparent border-transparent cursor-default"
                    : isToday
                      ? "bg-indigo-950/50 border-indigo-500 hover:bg-indigo-950/70"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-600"
                }`}
              >
                {cell.day && (
                  <>
                    <div
                      className={`text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1 ${
                        isToday ? "text-indigo-300" : "text-neutral-400"
                      }`}
                    >
                      {cell.day}
                      {isToday && <span className="hidden sm:inline"> · Hoy</span>}
                    </div>
                    {/* Small screens: just colored dots (still spec-compliant - US-08 allows dots or titles). */}
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {cell.items.slice(0, 4).map((it) => (
                        <ColorDot key={it.id} color={it.categoryColor ?? "#94A3B8"} />
                      ))}
                    </div>
                    <div className="hidden sm:block space-y-0.5">
                      {cell.items.slice(0, 3).map((it) => (
                        <div key={it.id} className="flex items-center gap-1 text-[10px] truncate text-neutral-200" title={it.title}>
                          <ColorDot color={it.categoryColor ?? "#94A3B8"} />
                          <span className="truncate">{it.title}</span>
                        </div>
                      ))}
                      {cell.items.length > 3 && (
                        <div className="text-[10px] text-neutral-500">+{cell.items.length - 3} más</div>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="mt-4">
        <CategoryLegend categories={categories} />
      </div>

      <Modal
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? `${selectedDay} de ${monthNames[month - 1]}` : ""}
      >
        {selectedItems.length === 0 ? (
          <p className="text-sm text-neutral-400">No tienes nada programado este día.</p>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-1">
                <ColorDot color={it.categoryColor ?? "#94A3B8"} />
                <span className="text-sm flex-1 min-w-0 truncate text-neutral-100">{it.title}</span>
                {it.isRepetitive && (
                  <span className="text-[10px] text-neutral-500 shrink-0">hábito</span>
                )}
                <button
                  onClick={() => removeItem(it.id, it.isRepetitive)}
                  className="text-neutral-600 hover:text-red-500 text-sm shrink-0"
                  aria-label="Borrar"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
