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

// Deletes the goal; the money set aside for it goes back to the spendable balance.
export async function deleteSavingsGoal(id: string) {
  const { data } = await api.delete<WalletDto>(`/savings/goals/${id}`);
  return data;
}

// Returns to the balance the fund money that belongs to no goal.
export async function releaseUnassignedSavings() {
  const { data } = await api.post<WalletDto>("/savings/release-unassigned");
  return data;
}

export async function allocateSavings(amount: number, savingsGoalId?: string | null, note?: string) {
  const { data } = await api.post<WalletDto>("/savings/allocate", { amount, note, savingsGoalId: savingsGoalId || null });
  return data;
}

export async function getSavingsMovements(goalId?: string) {
  const { data } = await api.get<SavingsMovementDto[]>("/savings/movements", { params: goalId ? { goalId } : undefined });
  return data;
}
