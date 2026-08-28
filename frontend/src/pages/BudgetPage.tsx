import { useEffect, useState } from "react";
import * as budgetApi from "../api/budget";
import type { BudgetProgressDto } from "../api/types";
import { Button, Card, PageTitle, ProgressBar } from "../components/ui";
import { MoneyField } from "../components/money";
import { useCurrency } from "../context/CurrencyContext";

export default function BudgetPage() {
  const { formatMoney } = useCurrency();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [progress, setProgress] = useState<BudgetProgressDto | null>(null);
  const [limitInput, setLimitInput] = useState<number | null>(null);

  const load = async () => {
    const data = await budgetApi.getBudget(year, month);
    setProgress(data);
    setLimitInput(data.limitAmount || null);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limitInput === null || limitInput <= 0) return;
    const data = await budgetApi.setBudget(year, month, limitInput);
    setProgress(data);
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  return (
    <div>
      <PageTitle title="Presupuesto mensual" subtitle="Define un límite de gasto y sigue tu avance en tiempo real." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold capitalize">{monthLabel}</h2>
            {progress && (
              <span className="text-sm text-neutral-400">
                {formatMoney(progress.spent)} de {formatMoney(progress.limitAmount)}
              </span>
            )}
          </div>
          {progress && <ProgressBar percent={progress.percentUsed} color={progress.color} />}
          {progress && (
            <p className="text-sm text-neutral-400 mt-2">
              Has usado el <span className="font-semibold">{progress.percentUsed}%</span> de tu presupuesto.
            </p>
          )}
          {progress && progress.percentUsed >= 90 && (
            <p className="text-sm text-red-400 mt-2 font-medium">
              ⚠️ Atención, estás muy cerca de llegar a tu objetivo máximo de gasto este mes.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Límite mensual</h2>
          <form onSubmit={handleSave} className="space-y-3">
            <MoneyField value={limitInput} onChange={setLimitInput} placeholder="Monto máximo" required />
            <Button type="submit" className="w-full">Guardar límite</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
