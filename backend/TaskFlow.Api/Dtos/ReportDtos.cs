namespace TaskFlow.Api.Dtos;

// Reports on the budget the wallet is executing ("Presupuesto planificado").
public record PlannedCategorySlice(string Category, decimal Amount, decimal Percent);

// One asset of the source Excel: what the user estimated vs the price range the AI found.
// PriceMin/PriceMax are null when the item is not quoted yet or the range has no CLP amount.
public record AssetQuoteComparison(string Name, decimal EstimatedAmount, decimal? PriceMin, decimal? PriceMax);

// InWallet: the analysed budget is the one the wallet executes, so its split uses the wallet's
// edited copy; otherwise it uses the budget's own Excel amounts.
public record PlannedBudgetReportDto(
    Guid? ProjectId,
    string? ProjectName,
    bool InWallet,
    decimal AssetsTotal,
    decimal LiabilitiesTotal,
    IReadOnlyList<PlannedCategorySlice> ByCategory,
    IReadOnlyList<AssetQuoteComparison> AssetQuotes);
