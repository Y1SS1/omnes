import { useEffect, useState } from "react";
import * as savingsApi from "../api/savings";
import * as walletApi from "../api/wallet";
import type { SavingsMovementDto, WalletDto } from "../api/types";
import { Button, Card, Input, PageTitle } from "../components/ui";

export default function SavingsPage() {
  const now = new Date();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [movements, setMovements] = useState<SavingsMovementDto[]>([]);

  const [allocateAmount, setAllocateAmount] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planSaved, setPlanSaved] = useState(false);

  const [projMonthly, setProjMonthly] = useState("");
  const [projMonths, setProjMonths] = useState("");
  const [projResult, setProjResult] = useState<number | null>(null);

  const [quotaTarget, setQuotaTarget] = useState("");
  const [quotaMonths, setQuotaMonths] = useState("");
  const [quotaResult, setQuotaResult] = useState<number | null>(null);

  const load = async () => {
    const [w, m] = await Promise.all([walletApi.getWallet(), savingsApi.getSavingsMovements()]);
    setWallet(w);
    setMovements(m);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(allocateAmount);
    if (Number.isNaN(amt) || amt <= 0) return;
    await savingsApi.allocateSavings(amt);
    setAllocateAmount("");
    load();
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(planAmount);
    if (Number.isNaN(amt) || amt <= 0) return;
    await savingsApi.setSavingsPlan(now.getFullYear(), now.getMonth() + 1, amt);
    setPlanSaved(true);
    setTimeout(() => setPlanSaved(false), 2000);
  };

  const handleProjection = async (e: React.FormEvent) => {
    e.preventDefault();
    const monthly = Number(projMonthly);
    const months = Number(projMonths);
    if (!monthly || !months) return;
    const result = await savingsApi.getProjection(monthly, months);
    setProjResult(result.projectedTotal);
  };

  const handleQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(quotaTarget);
    const months = Number(quotaMonths);
    if (!target || !months) return;
    const result = await savingsApi.getQuota(target, months);
    setQuotaResult(result.monthlyQuota);
  };

  const money = (n: number) => n.toLocaleString("es-CL", { style: "currency", currency: "CLP" });

  return (
    <div>
      <PageTitle title="Ahorros" subtitle="Separa dinero intocable y proyecta tus metas." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <p className="text-sm text-neutral-400">Fondo de ahorro intocable</p>
          <p className="text-3xl font-bold text-emerald-400 mb-4">{wallet ? money(wallet.savingsFund) : "—"}</p>
          <form onSubmit={handleAllocate} className="flex gap-2">
            <Input
              type="number"
              placeholder="Monto a apartar este mes"
              value={allocateAmount}
              onChange={(e) => setAllocateAmount(e.target.value)}
            />
            <Button type="submit">Apartar</Button>
          </form>
          <p className="text-xs text-neutral-500 mt-2">
            Saldo disponible actual: {wallet ? money(wallet.balance) : "—"}
          </p>
        </Card>

        <Card>
          <h2 className="font-semibold mb-2">Meta de ahorro del mes</h2>
          <p className="text-xs text-neutral-400 mb-3">
            Define cuánto planeas ahorrar este mes (se usa para comparar en Reportes).
          </p>
          <form onSubmit={handleSavePlan} className="flex gap-2">
            <Input
              type="number"
              placeholder="Meta planificada"
              value={planAmount}
              onChange={(e) => setPlanAmount(e.target.value)}
            />
            <Button type="submit">Guardar</Button>
          </form>
          {planSaved && <p className="text-xs text-emerald-400 mt-2">Meta guardada ✓</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="font-semibold mb-3">Calculadora de proyección</h2>
          <p className="text-xs text-neutral-400 mb-3">Monto mensual × plazo = total proyectado.</p>
          <form onSubmit={handleProjection} className="space-y-2">
            <Input type="number" placeholder="Monto mensual" value={projMonthly} onChange={(e) => setProjMonthly(e.target.value)} />
            <Input type="number" placeholder="Plazo en meses" value={projMonths} onChange={(e) => setProjMonths(e.target.value)} />
            <Button type="submit" className="w-full">Calcular</Button>
          </form>
          {projResult !== null && (
            <p className="text-sm mt-3">
              Tendrás <span className="font-semibold">{money(projResult)}</span> acumulados.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Calculadora de cuota</h2>
          <p className="text-xs text-neutral-400 mb-3">Meta total ÷ plazo = cuota mensual necesaria.</p>
          <form onSubmit={handleQuota} className="space-y-2">
            <Input type="number" placeholder="Meta total" value={quotaTarget} onChange={(e) => setQuotaTarget(e.target.value)} />
            <Input type="number" placeholder="Plazo en meses" value={quotaMonths} onChange={(e) => setQuotaMonths(e.target.value)} />
            <Button type="submit" className="w-full">Calcular</Button>
          </form>
          {quotaResult !== null && (
            <p className="text-sm mt-3">
              Debes ahorrar <span className="font-semibold">{money(quotaResult)}</span> cada mes.
            </p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold mb-3">Movimientos de ahorro</h2>
        {movements.length === 0 && <p className="text-sm text-neutral-500">Sin movimientos todavía.</p>}
        <ul className="divide-y divide-neutral-800">
          {movements.map((m) => (
            <li key={m.id} className="py-2 flex justify-between text-sm">
              <span>{new Date(m.date).toLocaleDateString("es-CL")}</span>
              <span className="font-semibold text-emerald-400">+{money(m.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
