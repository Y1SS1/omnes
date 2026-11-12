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
  // How far quoting got (quotedCount of assetCount) and whether the wallet executes this budget.
  assetCount: number;
  quotedCount: number;
  inWallet: boolean;
}

// A budget line copied from an imported Excel into the wallet ("Presupuesto planificado").
export interface PlannedItemDto {
  id: string;
  budgetProjectId: string;
  budgetProjectName: string;
  name: string;
  category: string;
  type: BudgetItemType;
  amount: number;
  createdAt: string;
}

export interface UpdatePlannedItemRequest {
  name: string;
  category: string;
  type: BudgetItemType;
  amount: number;
}

// Reports on the budget the wallet is executing.
export interface PlannedCategorySlice {
  category: string;
  amount: number;
  percent: number;
}

// priceMin/priceMax are null when the asset is not quoted yet or the AI gave no CLP amount.
export interface AssetQuoteComparison {
  name: string;
  estimatedAmount: number;
  priceMin: number | null;
  priceMax: number | null;
}

export interface PlannedBudgetReportDto {
  projectId: string | null;
  projectName: string | null;
  // True when the analysed budget is the one in the wallet (its split then uses the wallet's edits).
  inWallet: boolean;
  assetsTotal: number;
  liabilitiesTotal: number;
  byCategory: PlannedCategorySlice[];
  assetQuotes: AssetQuoteComparison[];
}

// "Describir con IA": a budget the AI proposes from a description, not saved until reviewed.
export interface BudgetDraftItemDto {
  name: string;
  category: string;
  type: BudgetItemType;
  estimatedAmount: number;
}

export interface BudgetDraftDto {
  items: BudgetDraftItemDto[];
  remainingToday: number;
}
