using System.Text.Json.Serialization;

namespace TaskFlow.Api.Dtos;

public record SetBudgetRequest([property: JsonRequired] int Year, [property: JsonRequired] int Month, [property: JsonRequired] decimal LimitAmount);

public record BudgetProgressDto(
    int Year, int Month, decimal LimitAmount, decimal Spent, decimal PercentUsed, string Color
);
