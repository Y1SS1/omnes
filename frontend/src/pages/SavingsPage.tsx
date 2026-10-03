import { useEffect, useState } from "react";
import * as savingsApi from "../api/savings";
import * as walletApi from "../api/wallet";
import type { SavingsGoalDto, SavingsMovementDto, WalletDto } from "../api/types";
import { Button, Card, Input, Modal, PageTitle, ProgressBar, Select } from "../components/ui";
import { MoneyField } from "../components/money";
import { useCurrency } from "../context/CurrencyContext";

function errorMessage(err: unknown): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data) return data;
  return "No se pudo completar la operación. Intenta de nuevo.";
}

export default function SavingsPage() {
  const { formatMoney } = useCurrency();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [goals, setGoals] = useState<SavingsGoalDto[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [movements, setMovements] = useState<SavingsMovementDto[]>([]);

  const [newGoalModalOpen, setNewGoalModalOpen] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState<number | null>(null);
  const [goalMonths, setGoalMonths] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [allocateAmount, setAllocateAmount] = useState<number | null>(null);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null;

  const loadGoals = async (keepSelection = true) => {
    const list = await savingsApi.getSavingsGoals();
    setGoals(list);
    if (!keepSelection || (selectedGoalId && !list.some((g) => g.id === selectedGoalId))) {
      setSelectedGoalId(list[0]?.id ?? null);
    } else if (!selectedGoalId && list.length > 0) {
      setSelectedGoalId(list[0].id);
    }
  };

  const loadWallet = async () => setWallet(await walletApi.getWallet());

  useEffect(() => {
    loadGoals(false);
    loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedGoalId) {
      savingsApi.getSavingsMovements(selectedGoalId).then(setMovements);
    } else {
      setMovements([]);
    }
  }, [selectedGoalId]);

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
      await Promise.all([loadGoals(), loadWallet()]);
      if (selectedGoalId) setMovements(await savingsApi.getSavingsMovements(selectedGoalId));
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <div>
      <PageTitle title="Ahorros" subtitle="Crea metas de ahorro con nombre y sigue el progreso de cada una." />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <Select
          value={selectedGoalId ?? ""}
          onChange={(e) => setSelectedGoalId(e.target.value || null)}
          className="max-w-xs"
        >
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
              <h2 className="text-xl font-bold text-ink">{selectedGoal.name}</h2>
              <button onClick={handleDeleteGoal} className="text-mid-gray hover:text-red-500 text-sm shrink-0">
                Borrar meta
              </button>
            </div>

            <ProgressBar
              percent={(selectedGoal.savedAmount / selectedGoal.targetAmount) * 100}
              color="green"
            />
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
              <Button type="submit">Apartar</Button>
            </form>
            {formError && <p className="text-sm text-red-400 mt-2">{formError}</p>}
            <p className="text-xs text-mid-gray mt-2">
              Saldo disponible actual: {wallet ? formatMoney(wallet.balance) : "—"} · Fondo total (todas las metas):{" "}
              {wallet ? formatMoney(wallet.savingsFund) : "—"}
            </p>
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Movimientos de "{selectedGoal.name}"</h2>
            {movements.length === 0 ? (
              <p className="text-sm text-mid-gray">Sin movimientos todavía para esta meta.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {movements.map((m) => (
                  <li key={m.id} className="py-2 flex justify-between text-sm">
                    <span className="text-mid-gray">{new Date(m.date).toLocaleDateString("es-CL")}</span>
                    <span className="font-semibold text-emerald-400">+{formatMoney(m.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

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
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <Button type="submit" className="w-full">Crear meta</Button>
        </form>
      </Modal>
    </div>
  );
}
