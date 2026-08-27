import { api } from "./client";
import type { SavingsMovementDto, WalletDto } from "./types";

export async function allocateSavings(amount: number, note?: string) {
  const { data } = await api.post<WalletDto>("/savings/allocate", { amount, note });
  return data;
}

export async function getSavingsMovements() {
  const { data } = await api.get<SavingsMovementDto[]>("/savings/movements");
  return data;
}

export async function getProjection(monthlyAmount: number, months: number) {
  const { data } = await api.get<{ monthlyAmount: number; months: number; projectedTotal: number }>(
    "/savings/projection",
    { params: { monthlyAmount, months } }
  );
  return data;
}

export async function getQuota(targetAmount: number, months: number) {
  const { data } = await api.get<{ targetAmount: number; months: number; monthlyQuota: number }>(
    "/savings/quota",
    { params: { targetAmount, months } }
  );
  return data;
}

export async function setSavingsPlan(year: number, month: number, plannedAmount: number) {
  await api.post("/savings/plan", { year, month, plannedAmount });
}
