import { useEffect, useState } from "react";
import * as walletApi from "../api/wallet";
import * as categoriesApi from "../api/categories";
import type { Category, TransactionDto, TransactionType, WalletDto } from "../api/types";
import { Button, Card, ColorDot, Input, Modal, PageTitle, Select } from "../components/ui";
import { MoneyField } from "../components/money";
import { useCurrency } from "../context/CurrencyContext";

function errorMessage(err: unknown): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data) return data;
  return "No se pudo completar la operación. Intenta de nuevo.";
}

export default function WalletPage() {
  const { formatMoney } = useCurrency();
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newBalance, setNewBalance] = useState<number | null>(null);

  const [amount, setAmount] = useState<number | null>(null);
  const [type, setType] = useState<TransactionType>("Expense");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    try {
      const [w, txs, cats] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(),
        categoriesApi.getCategories("Expense"),
      ]);
      setWallet(w);
      setTransactions(txs);
      setCategories(cats);
      setLoadError(null);
    } catch (err) {
      console.error("Failed to load wallet data", err);
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSetBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBalance === null) return;
    setFormError(null);
    try {
      await walletApi.setBalance(newBalance);
      setNewBalance(null);
      setBalanceModalOpen(false);
      load();
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
      load();
    } catch (err) {
      console.error("Failed to create transaction", err);
      setFormError(errorMessage(err));
    }
  };

  const removeTx = async (id: string) => {
    await walletApi.deleteTransaction(id);
    load();
  };

  return (
    <div>
      <PageTitle title="Billetera virtual" subtitle="Controla tu saldo y cada gasto o ingreso." />

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <Button variant="secondary" onClick={load}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <Card>
          <p className="text-sm text-neutral-400">Saldo disponible</p>
          <p className="text-3xl font-bold mb-4">
            {wallet ? formatMoney(wallet.balance) : loading ? "Cargando…" : "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setTxModalOpen(true)}>+ Nuevo gasto/ingreso</Button>
            <Button variant="secondary" onClick={() => setBalanceModalOpen(true)}>
              Ajustar saldo
            </Button>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Fondo de ahorro intocable</p>
          <p className="text-3xl font-bold text-emerald-400">
            {wallet ? formatMoney(wallet.savingsFund) : loading ? "Cargando…" : "—"}
          </p>
          <p className="text-xs text-neutral-500 mt-2">Administra tus ahorros en la sección Ahorros.</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold mb-3">Historial de movimientos</h2>
        {transactions.length === 0 && <p className="text-sm text-neutral-500">Sin movimientos todavía.</p>}
        <ul className="divide-y divide-neutral-800">
          {transactions.map((t) => (
            <li key={t.id} className="py-3 flex items-center gap-3">
              {t.categoryColor && <ColorDot color={t.categoryColor} />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-100 truncate">
                  {t.categoryName ?? "Sin categoría"} {t.description && `· ${t.description}`}
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(t.date).toLocaleDateString("es-CL", { dateStyle: "medium" })}
                </div>
              </div>
              <div className={`text-sm font-semibold shrink-0 whitespace-nowrap ${t.type === "Income" ? "text-emerald-400" : "text-red-500"}`}>
                {t.type === "Income" ? "+" : "-"}
                {formatMoney(t.amount)}
              </div>
              <button onClick={() => removeTx(t.id)} className="text-neutral-600 hover:text-red-500 text-sm">
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>

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
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <Button type="submit" className="w-full">Guardar</Button>
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
          <Select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="Expense">Gasto</option>
            <option value="Income">Ingreso</option>
          </Select>
          <MoneyField value={amount} onChange={setAmount} placeholder="Monto" required />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <Button type="submit" className="w-full">Guardar</Button>
        </form>
      </Modal>
    </div>
  );
}
