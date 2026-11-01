using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

public record BudgetItemToClassify(string Name, string Category);

public interface IBudgetItemClassifier
{
    // Returns one type per item, in the same order as the input.
    Task<IReadOnlyList<BudgetItemType>> ClassifyAsync(
        IReadOnlyList<BudgetItemToClassify> items, CancellationToken cancellationToken = default);
}

// The message is shown to the user as-is, so it must never carry provider details.
public class BudgetClassificationException : Exception
{
    public BudgetClassificationException(string message, Exception? inner = null) : base(message, inner) { }
}
