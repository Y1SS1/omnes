namespace TaskFlow.Api.Dtos;

public record SetBudgetRequest(int Year, int Month, decimal LimitAmount);

public record BudgetProgressDto(
    int Year, int Month, decimal LimitAmount, decimal Spent, decimal PercentUsed, string Color
);
