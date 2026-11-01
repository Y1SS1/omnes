namespace TaskFlow.Api.Services;

public record BudgetQuoteBlocks(string PriceRange, string BestValue, string Suppliers, string? Sources);

// The quote is stored as one plain-text field, written with fixed labels so that
// the table and the Excel can show each block in its own column.
public static class BudgetQuoteSummary
{
    private const string RangeLabel = "Rango: ";
    private const string BestValueLabel = " Mejor precio-calidad: ";
    private const string SuppliersLabel = " Proveedores sugeridos: ";
    private const string SourcesLabel = " Fuentes consultadas: ";

    public static string Format(string priceRange, string bestValue, string suppliers, IReadOnlyList<string> sources)
    {
        var summary = $"{RangeLabel}{priceRange}.{BestValueLabel}{bestValue}.{SuppliersLabel}{suppliers}.";
        return sources.Count == 0 ? summary : $"{summary}{SourcesLabel}{string.Join(", ", sources)}.";
    }

    public static BudgetQuoteBlocks? Parse(string? summary)
    {
        if (summary is null || !summary.StartsWith(RangeLabel)) return null;

        var bestValueAt = summary.IndexOf(BestValueLabel, StringComparison.Ordinal);
        if (bestValueAt < 0) return null;
        var suppliersAt = summary.IndexOf(SuppliersLabel, bestValueAt, StringComparison.Ordinal);
        if (suppliersAt < 0) return null;
        var sourcesAt = summary.IndexOf(SourcesLabel, suppliersAt, StringComparison.Ordinal);

        return new BudgetQuoteBlocks(
            Block(summary[RangeLabel.Length..bestValueAt]),
            Block(summary[(bestValueAt + BestValueLabel.Length)..suppliersAt]),
            Block(sourcesAt < 0 ? summary[(suppliersAt + SuppliersLabel.Length)..] : summary[(suppliersAt + SuppliersLabel.Length)..sourcesAt]),
            sourcesAt < 0 ? null : Block(summary[(sourcesAt + SourcesLabel.Length)..]));
    }

    private static string Block(string text) => text.Trim().TrimEnd('.');
}
