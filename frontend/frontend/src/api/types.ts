export type CategoryType = "Task" | "Expense" | "Income";
export type TransactionType = "Expense" | "Income";

export interface Category {
  id: string;
  name: string;
  color: string;
  type: CategoryType;
}

export interface WalletDto {
  balance: number;
  savingsFund: number;
}

export interface TransactionDto {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  description: string | null;
  date: string;
}

export interface BudgetProgressDto {
  year: number;
  month: number;
  limitAmount: number;
  spent: number;
  percentUsed: number;
  color: "green" | "yellow" | "red";
}

export type BudgetItemType = "Asset" | "Liability";

export interface BudgetQuoteBlocks {
  priceRange: string;
  bestValue: string;
  suppliers: string;
  sources: string | null;
}

export interface BudgetItemDto {
  id: string;
  name: string;
  type: BudgetItemType;
  category: string;
  estimatedAmount: number;
  aiQuoteSummary: string | null;
  aiQuotedAt: string | null;
  quote: BudgetQuoteBlocks | null;
}

export interface BudgetProjectDto {
  id: string;
  name: string;
  createdAt: string;
  items: BudgetItemDto[];
}

export interface BudgetProjectSummaryDto {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
}

export interface SavingsGoalDto {
  id: string;
  name: string;
  targetAmount: number;
  targetMonths: number;
  monthlyQuota: number;
  savedAmount: number;
  createdAt: string;
}

export interface SavingsMovementDto {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  savingsGoalId: string | null;
}

export interface NotificationDto {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface SavingsComparisonDto {
  planned: number;
  real: number;
}

export interface ExpenseCategorySlice {
  categoryName: string;
  color: string;
  amount: number;
  percent: number;
}
