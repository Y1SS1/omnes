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

public record UpdateBudgetItemTypeRequest(BudgetItemType Type);
