namespace TaskFlow.Api.Dtos;

// US-24: planned vs real savings for the month.
public record SavingsComparisonDto(decimal Planned, decimal Real);

// US-25: expenses by category for the month.
public record ExpenseCategorySlice(string CategoryName, string Color, decimal Amount, decimal Percent);
