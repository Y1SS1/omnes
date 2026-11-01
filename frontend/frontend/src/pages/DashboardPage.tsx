import { useEffect, useState } from "react";
import * as walletApi from "../api/wallet";
import * as budgetApi from "../api/budget";
import * as savingsApi from "../api/savings";
import type { BudgetProgressDto, SavingsGoalDto, TransactionDto, WalletDto } from "../api/types";
import { Card, ColorDot, PageTitle, ProgressBar } from "../components/ui";
import { useCurrency } from "../context/CurrencyContext";

export default function DashboardPage() {
  const { formatMoney } = useCurrency();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [budget, setBudget] = useState<BudgetProgressDto | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionDto[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalDto[]>([]);

  const load = async () => {
    const now = new Date();
    const [walletData, budgetData, transactions, goals] = await Promise.all([
      walletApi.getWallet(),
      budgetApi.getBudget(now.getFullYear(), now.getMonth() + 1),
      walletApi.getTransactions(),
      savingsApi.getSavingsGoals(),
    ]);
    setWallet(walletData);
    setBudget(budgetData);
    setRecentTransactions(transactions.slice(0, 5));
    setSavingsGoals(goals.slice(0, 3));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageTitle title="Resumen financiero" subtitle="Tu billetera de un vistazo." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <h2 className="font-semibold mb-3">Billetera</h2>
          <p className="text-sm text-mid-gray">Saldo disponible</p>
          <p className="text-3xl font-bold text-ink mb-4">
            {wallet !== null ? formatMoney(wallet.balance) : "—"}
          </p>
          <p className="text-sm text-mid-gray">Fondo de ahorro</p>
          <p className="text-xl font-semibold text-ink">
            {wallet !== null ? formatMoney(wallet.savingsFund) : "—"}
          </p>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Presupuesto del mes</h2>
          {budget && budget.limitAmount > 0 ? (
            <>
              <ProgressBar percent={budget.percentUsed} color={budget.color} />
              <p className="text-sm text-mid-gray mt-3">
                {formatMoney(budget.spent)} de {formatMoney(budget.limitAmount)}
              </p>
            </>
          ) : (
            <p className="text-sm text-mid-gray">Todavía no defines un presupuesto para este mes.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Metas de ahorro</h2>
          {savingsGoals.length === 0 ? (
            <p className="text-sm text-mid-gray">No tienes metas de ahorro creadas.</p>
          ) : (
            <ul className="space-y-3">
              {savingsGoals.map((g) => (
                <li key={g.id} className="text-sm">
                  <div className="flex justify-between text-ink mb-1">
                    <span>{g.name}</span>
                    <span className="text-mid-gray">
                      {formatMoney(g.savedAmount)} / {formatMoney(g.targetAmount)}
                    </span>
                  </div>
                  <ProgressBar
                    percent={g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0}
                    color="green"
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="font-semibold mb-3">Movimientos recientes</h2>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-mid-gray">Todavía no registras movimientos.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {recentTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {t.categoryColor && <ColorDot color={t.categoryColor} />}
                    <span className="truncate text-ink">{t.categoryName ?? t.description ?? "Movimiento"}</span>
                  </div>
                  <span className={t.type === "Income" ? "text-emerald-600 font-medium" : "text-ink"}>
                    {t.type === "Income" ? "+" : "-"}
                    {formatMoney(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
