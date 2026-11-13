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

// AssetCount/QuotedCount show how far quoting got; InWallet marks the budget the wallet is executing.
public record BudgetProjectSummaryDto(
    Guid Id, string Name, DateTime CreatedAt, int ItemCount, int AssetCount, int QuotedCount, bool InWallet);

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

// Adds items to a budget that already exists (the "¿Qué me falta?" suggestions the user picked).
public record AddBudgetItemsRequest(List<CreateBudgetItemRequest>? Items);

// "¿Qué me falta?": the goal the review aims at, e.g. "duplicar la venta de pollos" (required).
public record ReviewBudgetRequest(string? Goal);

// "¿Qué me falta?": what the AI thinks the budget is missing; nothing is saved yet.
public record BudgetSuggestionDto(
    string Name, string Category, BudgetItemType Type, decimal EstimatedAmount, string Reason);

public record BudgetReviewDto(IReadOnlyList<BudgetSuggestionDto> Suggestions, int RemainingToday);
