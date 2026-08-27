export type TaskKind = "Task" | "Note" | "DoneActivity";
export type DeadlineScope = "None" | "Today" | "Week" | "Month";
export type CategoryType = "Task" | "Expense";
export type TransactionType = "Expense" | "Income";

export const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type DayName = (typeof ALL_DAYS)[number];

export interface Category {
  id: string;
  name: string;
  color: string;
  type: CategoryType;
}

export interface TaskItemDto {
  id: string;
  title: string;
  description: string | null;
  kind: TaskKind;
  deadlineScope: DeadlineScope;
  dueAt: string | null;
  isRepetitive: boolean;
  repeatDays: string; // comma-separated day names, e.g. "Monday, Tuesday"
  isCompleted: boolean;
  completedAt: string | null;
  categoryId: string | null;
  categoryColor: string | null;
  categoryName: string | null;
  createdAt: string;
  habitCheckedToday: boolean | null;
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

export interface SavingsMovementDto {
  id: string;
  amount: number;
  date: string;
  note: string | null;
}

export interface NotificationDto {
  id: string;
  message: string;
  relatedTaskId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface HabitCompletionReportItem {
  habitTitle: string;
  daysScheduled: number;
  daysCompleted: number;
  successPercent: number;
}

export interface ProductivityPoint {
  date: string;
  completedCount: number;
}

export interface TaskCategorySlice {
  categoryName: string;
  color: string;
  count: number;
  percent: number;
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
