import { useEffect, useMemo, useState } from "react";
import * as tasksApi from "../api/tasks";
import type { TaskItemDto } from "../api/types";
import { Button, Card, ColorDot, PageTitle } from "../components/ui";

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [items, setItems] = useState<TaskItemDto[]>([]);

  useEffect(() => {
    tasksApi.getCalendar(year, month).then(setItems);
  }, [year, month]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

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

  return (
    <div>
      <PageTitle title="Calendario" subtitle="Vista mensual de tus tareas y hábitos, codificados por color." />

      <div className="flex items-center justify-between mb-4">
        <Button variant="secondary" onClick={() => changeMonth(-1)}>← Anterior</Button>
        <h2 className="font-semibold text-lg">{monthNames[month - 1]} {year}</h2>
        <Button variant="secondary" onClick={() => changeMonth(1)}>Siguiente →</Button>
      </div>

      <Card>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500 mb-2">
          {weekDayLabels.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => (
            <div
              key={idx}
              className={`min-h-24 rounded-lg border border-neutral-800 p-1.5 ${
                cell.day ? "bg-neutral-950" : "bg-transparent border-transparent"
              }`}
            >
              {cell.day && (
                <>
                  <div className="text-xs font-medium text-neutral-400 mb-1">{cell.day}</div>
                  <div className="space-y-0.5">
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
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
