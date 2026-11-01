import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as reportsApi from "../api/reports";
import type { ExpenseCategorySlice, SavingsComparisonDto } from "../api/types";
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

  const [savingsComparison, setSavingsComparison] = useState<SavingsComparisonDto | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategorySlice[]>([]);

  useEffect(() => {
    reportsApi.getSavingsComparison(year, month).then(setSavingsComparison);
    reportsApi.getExpensesByCategory(year, month).then(setExpenseCategories);
  }, []);

  return (
    <div>
      <PageTitle title="Reportes y métricas" subtitle="Rendimiento financiero del mes." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <Card>
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
