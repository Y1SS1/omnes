using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

// One line of a budget the AI proposes from a description; the user reviews it before anything is saved.
public record BudgetDraftItem(string Name, string Category, BudgetItemType Type, decimal EstimatedAmount);

public interface IBudgetDrafter
{
    // Proposes the items of a budget from what the user describes, optionally sized to a target total.
    Task<IReadOnlyList<BudgetDraftItem>> DraftAsync(
        string description, decimal? targetAmount, CancellationToken cancellationToken = default);
}

// The message is shown to the user as-is, so it must never carry provider details.
public class BudgetDraftException : Exception
{
    public BudgetDraftException(string message, Exception? inner = null) : base(message, inner) { }
}
