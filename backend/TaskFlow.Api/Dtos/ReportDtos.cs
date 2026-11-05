namespace TaskFlow.Api.Dtos;

// Reports on the budget the wallet is executing ("Presupuesto planificado").
public record PlannedCategorySlice(string Category, decimal Amount, decimal Percent);

// One asset of the source Excel: what the user estimated vs the price range the AI found.
// PriceMin/PriceMax are null when the item is not quoted yet or the range has no CLP amount.
public record AssetQuoteComparison(string Name, decimal EstimatedAmount, decimal? PriceMin, decimal? PriceMax);

public record PlannedBudgetReportDto(
    Guid? ProjectId,
    string? ProjectName,
    decimal AssetsTotal,
    decimal LiabilitiesTotal,
    IReadOnlyList<PlannedCategorySlice> ByCategory,
    IReadOnlyList<AssetQuoteComparison> AssetQuotes);
