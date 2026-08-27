import { api } from "./client";
import type { TransactionDto, TransactionType, WalletDto } from "./types";

export async function getWallet() {
  const { data } = await api.get<WalletDto>("/wallet");
  return data;
}

export async function setBalance(amount: number) {
  const { data } = await api.post<WalletDto>("/wallet/balance", { amount });
  return data;
}

export async function getTransactions(year?: number, month?: number) {
  const { data } = await api.get<TransactionDto[]>("/transactions", {
    params: year && month ? { year, month } : undefined,
  });
  return data;
}

export async function createTransaction(input: {
  amount: number;
  type: TransactionType;
  categoryId?: string | null;
  description?: string | null;
  date?: string | null;
}) {
  const { data } = await api.post<TransactionDto>("/transactions", input);
  return data;
}

export async function deleteTransaction(id: string) {
  await api.delete(`/transactions/${id}`);
}
