namespace TaskFlow.Api.Services;

public interface IBudgetItemQuoter
{
    // Returns the plain text stored next to the item: price range, best-value option, suppliers and sources.
    Task<string> QuoteAsync(string name, string category, CancellationToken cancellationToken = default);
}

// Its message is safe to show to the user as-is.
public class BudgetQuoteException : Exception
{
    public BudgetQuoteException(string message, Exception? innerException = null) : base(message, innerException) { }
}
