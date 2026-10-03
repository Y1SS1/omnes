import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as reportsApi from "../api/reports";
import type {
  ExpenseCategorySlice,
  HabitCompletionReportItem,
  ProductivityPoint,
  SavingsComparisonDto,
  TaskCategorySlice,
} from "../api/types";
import { Card, PageTitle } from "../components/ui";
import { useCurrency } from "../context/CurrencyContext";

const axisTick = { fill: "#a3a3a3", fontSize: 11 };
const gridStroke = "#404040";
const tooltipStyle = {
  contentStyle: { background: "#171717", border: "1px solid #404040", borderRadius: 8, color: "#fff" },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#e5e5e5" },
};
const legendStyle = { color: "#d4d4d4" };

export default function ReportsPage() {
  const { formatMoney } = useCurrency();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [habitReport, setHabitReport] = useState<HabitCompletionReportItem[]>([]);
  const [productivity, setProductivity] = useState<ProductivityPoint[]>([]);
  const [taskCategories, setTaskCategories] = useState<TaskCategorySlice[]>([]);
  const [savingsComparison, setSavingsComparison] = useState<SavingsComparisonDto | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategorySlice[]>([]);

  useEffect(() => {
    const to = now.toISOString().slice(0, 10);
    const from = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);

    reportsApi.getHabitCompletionReport(year, month).then(setHabitReport);
    reportsApi.getProductivityTimeline(from, to).then(setProductivity);
    reportsApi.getTaskCategoriesReport(year, month).then(setTaskCategories);
    reportsApi.getSavingsComparison(year, month).then(setSavingsComparison);
    reportsApi.getExpensesByCategory(year, month).then(setExpenseCategories);
  }, []);

  return (
    <div>
      <PageTitle title="Reportes y métricas" subtitle="Productividad y rendimiento financiero del mes." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold mb-1">Cumplimiento de hábitos</h2>
          <p className="text-xs text-mid-gray mb-3">Días cumplidos vs. días programados este mes.</p>
          {habitReport.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={habitReport}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="habitTitle" tick={axisTick} />
                <YAxis allowDecimals={false} tick={axisTick} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={legendStyle} />
                <Bar dataKey="daysCompleted" name="Cumplidos" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="daysScheduled" name="Programados" fill="#71717a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-1">Línea de productividad</h2>
          <p className="text-xs text-mid-gray mb-3">Tareas y hábitos completados por día (últimos 7 días).</p>
          {productivity.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={productivity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="date" tick={axisTick} />
                <YAxis allowDecimals={false} tick={axisTick} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="completedCount" name="Completadas" stroke="#818cf8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-1">Distribución por categoría</h2>
          <p className="text-xs text-mid-gray mb-3">Tareas completadas este mes, por color/categoría.</p>
          {taskCategories.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={taskCategories}
                  dataKey="count"
                  nameKey="categoryName"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry: any) => `${entry.categoryName} (${entry.percent}%)`}
                >
                  {taskCategories.map((slice, idx) => (
                    <Cell key={idx} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-1">Ahorro real vs. planificado</h2>
          <p className="text-xs text-mid-gray mb-3">Meta del mes vs. lo depositado en el fondo.</p>
          {savingsComparison && (savingsComparison.planned > 0 || savingsComparison.real > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={[
                  { name: "Meta Planificada", value: savingsComparison.planned },
                  { name: "Ahorro Real", value: savingsComparison.real },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 12 }} />
                <YAxis tick={axisTick} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  <Cell fill="#71717a" />
                  <Cell fill="#10B981" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-semibold mb-1">Gastos por categoría</h2>
          <p className="text-xs text-mid-gray mb-3">Desglose de tu gasto mensual, de mayor a menor.</p>
          {expenseCategories.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={expenseCategories}
                  dataKey="amount"
                  nameKey="categoryName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry: any) => `${entry.categoryName} (${entry.percent}%)`}
                >
                  {expenseCategories.map((slice, idx) => (
                    <Cell key={idx} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: any) => formatMoney(Number(value))}
                />
                <Legend wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return <p className="text-sm text-mid-gray py-10 text-center">Aún no hay datos suficientes para este gráfico.</p>;
}
