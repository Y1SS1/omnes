using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

// One item already in the budget, as the reviewer sees it.
public record BudgetItemToReview(string Name, string Category, BudgetItemType Type, decimal EstimatedAmount);

// Something the AI thinks the budget is missing, with why; the user picks which ones to add.
public record BudgetSuggestion(
    string Name, string Category, BudgetItemType Type, decimal EstimatedAmount, string Reason);

public interface IBudgetReviewer
{
    // "¿Qué me falta?": reads a budget and proposes what it needs to reach the user goal
    // ("duplicar la venta de pollos"). An empty list is a valid answer (nothing is missing).
    Task<IReadOnlyList<BudgetSuggestion>> ReviewAsync(
        string budgetName, IReadOnlyList<BudgetItemToReview> items, string goal,
        CancellationToken cancellationToken = default);
}

// The message is shown to the user as-is, so it must never carry provider details.
public class BudgetReviewException : Exception
{
    public BudgetReviewException(string message, Exception? inner = null) : base(message, inner) { }
}
