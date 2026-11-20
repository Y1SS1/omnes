namespace TaskFlow.Api.Services;

public interface IBudgetItemQuoter
{
    // Returns the plain text stored next to the item: price range, best-value option, suppliers, and
    // either the sources consulted or, with includeBuyLinks, product pages where it can be bought.
    Task<string> QuoteAsync(string name, string category, bool includeBuyLinks = false, CancellationToken cancellationToken = default);
}

// Its message is safe to show to the user as-is.
public class BudgetQuoteException : Exception
{
    public BudgetQuoteException(string message, Exception? innerException = null) : base(message, innerException) { }
}
