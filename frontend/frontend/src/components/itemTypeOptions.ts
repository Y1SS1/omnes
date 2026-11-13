import type { BudgetItemType } from "../api/types";
import type { SelectOption } from "./Select";

// The Activo/Pasivo choice, shared by every list that classifies a budget item.
export const ITEM_TYPE_OPTIONS: SelectOption<BudgetItemType>[] = [
  { value: "Asset", label: "Activo" },
  { value: "Liability", label: "Pasivo" },
];
