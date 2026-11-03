import { useEffect, useState } from "react";
import * as walletApi from "../api/wallet";
import * as categoriesApi from "../api/categories";
import * as budgetApi from "../api/budget";
import * as savingsApi from "../api/savings";
import type {
  BudgetProgressDto,
  Category,
  SavingsGoalDto,
  SavingsMovementDto,
  TransactionDto,
  TransactionType,
  WalletDto,
} from "../api/types";
import { Button, Card, ColorDot, Input, Modal, PageTitle, ProgressBar, Select } from "../components/ui";
import { MoneyField } from "../components/money";
import { TriangleAlert, X } from "lucide-react";
import { useCurrency } from "../context/CurrencyContext";

function errorMessage(err: unknown): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data) return data;
  return "No se pudo completar la operación. Intenta de nuevo.";
}

function TransactionRow({ t, onDelete, formatMoney }: { t: TransactionDto; onDelete: (id: string) => void; formatMoney: (n: number) => string }) {
  return (
    <li className="py-3 flex items-center gap-3">
      {t.categoryColor && <ColorDot color={t.categoryColor} />}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink truncate">
          {t.categoryName ?? "Sin categoría"} {t.description && `· ${t.description}`}
        </div>
        <div className="text-xs text-mid-gray">{new Date(t.date).toLocaleDateString("es-CL", { dateStyle: "medium" })}</div>
      </div>
      <div className={`text-sm font-semibold shrink-0 whitespace-nowrap tabular-nums ${t.type === "Income" ? "text-mint" : "text-ember"}`}>
        {t.type === "Income" ? "+" : "-"}
        {formatMoney(t.amount)}
      </div>
      <button onClick={() => onDelete(t.id)} className="rounded-full p-1 text-mid-gray hover:bg-red-50 hover:text-ember" aria-label="Borrar movimiento">
        <X size={15} aria-hidden="true" />
      </button>
    </li>
  );
}

export default function WalletPage() {
  const { formatMoney } = useCurrency();

  // --- Wallet + transactions ---
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [type, setType] = useState<TransactionType>("Expense");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  // --- Budget ---
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [budget, setBudget] = useState<BudgetProgressDto | null>(null);
  const [limitInput, setLimitInput] = useState<number | null>(null);

  // --- Savings ---
  const [goals, setGoals] = useState<SavingsGoalDto[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [movements, setMovements] = useState<SavingsMovementDto[]>([]);
  const [newGoalModalOpen, setNewGoalModalOpen] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [goalMonths, setGoalMonths] = useState("");
  const [allocateAmount, setAllocateAmount] = useState<number | null>(null);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;

  const loadWalletData = async () => {
    try {
      const [w, txs, expenseCats, incomeCats] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(),
        categoriesApi.getCategories("Expense"),
        categoriesApi.getCategories("Income"),
      ]);
      setWallet(w);
      setTransactions(txs);
      setCategories([...expenseCats, ...incomeCats]);
      setLoadError(null);
    } catch (err) {
      console.error("Failed to load wallet data", err);
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Lighter refresh for actions (budget/savings) that only move wallet
  // numbers around, without re-fetching the whole transaction history.
  const refreshWallet = async () => setWallet(await walletApi.getWallet());

  const loadBudget = async () => {
    const data = await budgetApi.getBudget(year, month);
    setBudget(data);
    setLimitInput(data.limitAmount || null);
  };

  const loadGoals = async (keepSelection = true) => {
    const list = await savingsApi.getSavingsGoals();
    setGoals(list);
    if (!keepSelection || (selectedGoalId && !list.some((g) => g.id === selectedGoalId))) {
      setSelectedGoalId(list[0]?.id ?? null);
    } else if (!selectedGoalId && list.length > 0) {
      setSelectedGoalId(list[0].id);
    }
  };

  useEffect(() => {
    loadWalletData();
    loadBudget();
    loadGoals(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedGoalId) {
      savingsApi.getSavingsMovements(selectedGoalId).then(setMovements);
    } else {
      setMovements([]);
    }
  }, [selectedGoalId]);

  const handleSetBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBalance === null) return;
    setFormError(null);
    try {
      await walletApi.setBalance(newBalance);
      setNewBalance(null);
      setBalanceModalOpen(false);
      loadWalletData();
    } catch (err) {
      console.error("Failed to set balance", err);
      setFormError(errorMessage(err));
    }
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === null || amount <= 0) return;
    setFormError(null);
    try {
      await walletApi.createTransaction({
        amount,
        type,
        categoryId: categoryId || null,
        description: description || null,
      });
      setAmount(null);
      setDescription("");
      setCategoryId("");
      setTxModalOpen(false);
      loadWalletData();
      loadBudget();
    } catch (err) {
      console.error("Failed to create transaction", err);
      setFormError(errorMessage(err));
    }
  };

  const removeTx = async (id: string) => {
    await walletApi.deleteTransaction(id);
    loadWalletData();
    loadBudget();
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limitInput === null || limitInput <= 0) return;
    const data = await budgetApi.setBudget(year, month, limitInput);
    setBudget(data);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const months = Number(goalMonths);
    if (!goalName.trim() || goalTarget === null || goalTarget <= 0 || !months || months <= 0) return;
    setFormError(null);
    try {
      const goal = await savingsApi.createSavingsGoal(goalName.trim(), goalTarget, months);
      setGoalName("");
      setGoalTarget(null);
      setGoalMonths("");
      setNewGoalModalOpen(false);
      await loadGoals();
      setSelectedGoalId(goal.id);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const handleDeleteGoal = async () => {
    if (!selectedGoal) return;
    if (!window.confirm(`¿Borrar la meta "${selectedGoal.name}"? El dinero ya apartado se mantiene en tu fondo, solo deja de estar etiquetado con esta meta.`)) {
      return;
    }
    await savingsApi.deleteSavingsGoal(selectedGoal.id);
    await loadGoals(false);
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allocateAmount === null || allocateAmount <= 0) return;
    setFormError(null);
    try {
      await savingsApi.allocateSavings(allocateAmount, selectedGoalId);
      setAllocateAmount(null);
      await Promise.all([loadGoals(), refreshWallet()]);
      if (selectedGoalId) setMovements(await savingsApi.getSavingsMovements(selectedGoalId));
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  const recentTransactions = transactions.slice(0, 4);

  return (
    <div>
      <PageTitle title="Billetera" subtitle="Tu saldo, presupuesto y ahorros en un solo lugar." />

      {loadError && (
        <div className="mb-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-ember flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <Button variant="secondary" onClick={loadWalletData}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Saldo disponible + últimos movimientos */}
        <Card>
          <p className="text-sm text-mid-gray">Saldo disponible</p>
          <p className="font-display text-4xl font-extrabold tracking-tight tabular-nums mb-4">{wallet ? formatMoney(wallet.balance) : loading ? "Cargando…" : "—"}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setTxModalOpen(true)}>+ Nuevo gasto/ingreso</Button>
            <Button variant="secondary" onClick={() => setBalanceModalOpen(true)}>
              Ajustar saldo
            </Button>
          </div>

          <div className="border-t border-hairline mt-4 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Últimos movimientos</h3>
              {transactions.length > 4 && (
                <button onClick={() => setHistoryModalOpen(true)} className="text-xs text-brand font-semibold hover:underline">
                  Ver historial completo
                </button>
              )}
            </div>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-mid-gray">Sin movimientos todavía.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {recentTransactions.map((t) => (
                  <TransactionRow key={t.id} t={t} onDelete={removeTx} formatMoney={formatMoney} />
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Presupuesto mensual (todo en un cuadro) */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold">Presupuesto de {monthLabel}</h2>
            {budget && (
              <span className="text-sm text-mid-gray">
                {formatMoney(budget.spent)} de {formatMoney(budget.limitAmount)}
              </span>
            )}
          </div>
          {budget && <ProgressBar percent={budget.percentUsed} color={budget.color} />}
          {budget && (
            <p className="text-sm text-mid-gray mt-2">
              Has usado el <span className="font-semibold">{budget.percentUsed}%</span> de tu presupuesto.
            </p>
          )}
          {budget && budget.percentUsed >= 90 && (
            <p className="flex items-start gap-1.5 text-sm text-ember mt-2 font-medium">
              <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              Atención, estás muy cerca de llegar a tu objetivo máximo de gasto este mes.
            </p>
          )}

          <div className="border-t border-hairline mt-4 pt-4">
            <h3 className="font-semibold text-sm mb-2">Límite mensual</h3>
            <form onSubmit={handleSaveBudget} className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[8rem]">
                <MoneyField value={limitInput} onChange={setLimitInput} placeholder="Monto máximo" required />
              </div>
              <Button type="submit">Guardar</Button>
            </form>
          </div>
        </Card>
      </div>

      {/* Ahorros */}
      <PageTitle title="Ahorros" subtitle="Crea metas de ahorro con nombre y sigue el progreso de cada una." />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Select value={selectedGoalId ?? ""} onChange={(e) => setSelectedGoalId(e.target.value || null)} className="max-w-xs">
          {goals.length === 0 && <option value="">Sin metas todavía</option>}
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Button onClick={() => setNewGoalModalOpen(true)}>+ Nueva meta</Button>
      </div>

      {!selectedGoal ? (
        <Card>
          <p className="text-sm text-mid-gray">
            Todavía no tienes ninguna meta de ahorro. Crea la primera con "+ Nueva meta" — por ejemplo, "Cambio de
            maquinaria", con el monto que necesitas y en cuántos meses quieres lograrlo.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-2xl font-extrabold text-ink">{selectedGoal.name}</h2>
              <button onClick={handleDeleteGoal} className="text-mid-gray hover:text-ember text-sm shrink-0">
                Borrar meta
              </button>
            </div>

            <ProgressBar percent={(selectedGoal.savedAmount / selectedGoal.targetAmount) * 100} color="green" />
            <p className="text-sm text-mid-gray mt-2">
              Ahorrado <span className="font-semibold text-ink">{formatMoney(selectedGoal.savedAmount)}</span> de{" "}
              {formatMoney(selectedGoal.targetAmount)} (
              {Math.min(100, Math.round((selectedGoal.savedAmount / selectedGoal.targetAmount) * 100))}%)
            </p>
            <p className="text-sm text-mid-gray mt-1">
              Necesitas ahorrar <span className="font-semibold text-ink">{formatMoney(selectedGoal.monthlyQuota)}</span> al
              mes durante {selectedGoal.targetMonths} {selectedGoal.targetMonths === 1 ? "mes" : "meses"} para llegar a la meta.
            </p>

            <form onSubmit={handleAllocate} className="flex flex-wrap gap-2 mt-4">
              <div className="flex-1 min-w-[10rem]">
                <MoneyField value={allocateAmount} onChange={setAllocateAmount} placeholder="Monto a apartar" />
              </div>
              <Button type="button" variant="secondary" onClick={() => setAllocateAmount(selectedGoal.monthlyQuota)}>
                Cuota sugerida ({formatMoney(selectedGoal.monthlyQuota)})
              </Button>
              <Button type="submit">Apartar</Button>
            </form>
            {formError && <p className="text-sm text-ember mt-2">{formError}</p>}
            <p className="text-xs text-mid-gray mt-2">
              Saldo disponible actual: {wallet ? formatMoney(wallet.balance) : "—"} · Fondo total (todas las metas):{" "}
              {wallet ? formatMoney(wallet.savingsFund) : "—"}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-extrabold mb-3">Movimientos de "{selectedGoal.name}"</h2>
            {movements.length === 0 ? (
              <p className="text-sm text-mid-gray">Sin movimientos todavía para esta meta.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {movements.map((m) => (
                  <li key={m.id} className="py-2 flex justify-between text-sm">
                    <span className="text-mid-gray">{new Date(m.date).toLocaleDateString("es-CL")}</span>
                    <span className="font-semibold tabular-nums text-mint">+{formatMoney(m.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {/* --- Modals --- */}

      <Modal
        open={balanceModalOpen}
        onClose={() => {
          setBalanceModalOpen(false);
          setFormError(null);
        }}
        title="Ajustar saldo disponible"
      >
        <form onSubmit={handleSetBalance} className="space-y-3">
          <MoneyField value={newBalance} onChange={setNewBalance} placeholder="Monto" required />
          {formError && <p className="text-sm text-ember">{formError}</p>}
          <Button type="submit" className="w-full">
            Guardar
          </Button>
        </form>
      </Modal>

      <Modal
        open={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setFormError(null);
        }}
        title="Nuevo gasto o ingreso"
      >
        <form onSubmit={handleCreateTx} className="space-y-3">
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value as TransactionType);
              setCategoryId("");
            }}
          >
            <option value="Expense">Gasto</option>
            <option value="Income">Ingreso</option>
          </Select>
          <MoneyField value={amount} onChange={setAmount} placeholder="Monto" required />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories
              .filter((c) => c.type === type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          {formError && <p className="text-sm text-ember">{formError}</p>}
          <Button type="submit" className="w-full">
            Guardar
          </Button>
        </form>
      </Modal>

      <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title="Historial completo de movimientos">
        {transactions.length === 0 ? (
          <p className="text-sm text-mid-gray">Sin movimientos todavía.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {transactions.map((t) => (
              <TransactionRow key={t.id} t={t} onDelete={removeTx} formatMoney={formatMoney} />
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={newGoalModalOpen} onClose={() => { setNewGoalModalOpen(false); setFormError(null); }} title="Nueva meta de ahorro">
        <form onSubmit={handleCreateGoal} className="space-y-3">
          <Input
            placeholder='Motivo, ej: "Cambio de maquinaria"'
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            required
          />
          <MoneyField value={goalTarget} onChange={setGoalTarget} placeholder="¿Cuánto quieres ahorrar?" required />
          <Input
            type="number"
            placeholder="¿En cuántos meses?"
            value={goalMonths}
            onChange={(e) => setGoalMonths(e.target.value)}
            required
          />
          {formError && <p className="text-sm text-ember">{formError}</p>}
          <Button type="submit" className="w-full">
            Crear meta
          </Button>
        </form>
      </Modal>
    </div>
  );
}
