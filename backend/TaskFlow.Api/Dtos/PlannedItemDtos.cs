using System.Text.Json.Serialization;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Dtos;

public record PlannedItemDto(
    Guid Id,
    Guid BudgetProjectId,
    string BudgetProjectName,
    string Name,
    string Category,
    BudgetItemType Type,
    decimal Amount,
    DateTime CreatedAt
);

public record UpdatePlannedItemRequest(
    string? Name,
    string? Category,
    [property: JsonRequired] BudgetItemType Type,
    [property: JsonRequired] decimal Amount
);
