import { api } from "./client";
import type { SavingsGoalDto, SavingsMovementDto, WalletDto } from "./types";

export async function getSavingsGoals() {
  const { data } = await api.get<SavingsGoalDto[]>("/savings/goals");
  return data;
}

export async function createSavingsGoal(name: string, targetAmount: number, targetMonths: number) {
  const { data } = await api.post<SavingsGoalDto>("/savings/goals", { name, targetAmount, targetMonths });
  return data;
}

export async function deleteSavingsGoal(id: string) {
  await api.delete(`/savings/goals/${id}`);
}

export async function allocateSavings(amount: number, savingsGoalId?: string | null, note?: string) {
  const { data } = await api.post<WalletDto>("/savings/allocate", { amount, note, savingsGoalId: savingsGoalId || null });
  return data;
}

export async function getSavingsMovements(goalId?: string) {
  const { data } = await api.get<SavingsMovementDto[]>("/savings/movements", { params: goalId ? { goalId } : undefined });
  return data;
}
