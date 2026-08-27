import { useEffect, useState } from "react";
import * as budgetApi from "../api/budget";
import type { BudgetProgressDto } from "../api/types";
import { Button, Card, Input, PageTitle, ProgressBar } from "../components/ui";

export default function BudgetPage() {
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [progress, setProgress] = useState<BudgetProgressDto | null>(null);
  const [limitInput, setLimitInput] = useState("");

  const load = async () => {
    const data = await budgetApi.getBudget(year, month);
    setProgress(data);
    setLimitInput(data.limitAmount ? String(data.limitAmount) : "");
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(limitInput);
    if (Number.isNaN(amt) || amt <= 0) return;
    const data = await budgetApi.setBudget(year, month, amt);
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
                {progress.spent.toLocaleString("es-CL", { style: "currency", currency: "CLP" })} de{" "}
                {progress.limitAmount.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}
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
            <Input
              type="number"
              placeholder="Monto máximo"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">Guardar límite</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
