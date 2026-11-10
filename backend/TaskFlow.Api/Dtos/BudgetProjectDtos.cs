using System.Text.Json.Serialization;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Dtos;

public record BudgetItemDto(
    Guid Id,
    string Name,
    BudgetItemType Type,
    string Category,
    decimal EstimatedAmount,
    string? AiQuoteSummary,
    DateTime? AiQuotedAt,
    BudgetQuoteBlocks? Quote
);

public record BudgetProjectDto(Guid Id, string Name, DateTime CreatedAt, IReadOnlyList<BudgetItemDto> Items);

public record BudgetProjectSummaryDto(Guid Id, string Name, DateTime CreatedAt, int ItemCount);

public record UpdateBudgetItemTypeRequest([property: JsonRequired] BudgetItemType Type);

public record RenameBudgetProjectRequest(string? Name);

// "Describir con IA": the AI proposes items from a description; nothing is saved yet.
public record DraftBudgetRequest(string? Description, decimal? TargetAmount);

public record BudgetDraftItemDto(string Name, string Category, BudgetItemType Type, decimal EstimatedAmount);

public record BudgetDraftDto(IReadOnlyList<BudgetDraftItemDto> Items, int RemainingToday);

// Saves a budget from a list the user reviewed (the AI draft, edited), with the Excel's limits.
public record CreateBudgetItemRequest(
    string? Name,
    string? Category,
    [property: JsonRequired] BudgetItemType Type,
    [property: JsonRequired] decimal EstimatedAmount);

public record CreateBudgetProjectRequest(string? Name, List<CreateBudgetItemRequest>? Items);
