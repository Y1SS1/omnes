using System.Text.RegularExpressions;

namespace TaskFlow.Api.Services;

// A product page where the best-value option can be bought, found by the quote's web search.
public record BudgetBuyLink(string Store, string Url);

// BuyLinks replaces Sources when the user asked for purchase links: both point to the same pages,
// so showing both would repeat them.
public record BudgetQuoteBlocks(
    string PriceRange, string BestValue, string Suppliers, string? Sources, IReadOnlyList<BudgetBuyLink>? BuyLinks = null);

// The quote is stored as one plain-text field, written with fixed labels so that
// the table and the Excel can show each block in its own column.
public static partial class BudgetQuoteSummary
{
    private const string RangeLabel = "Rango: ";
    private const string BestValueLabel = " Mejor precio-calidad: ";
    private const string SuppliersLabel = " Proveedores sugeridos: ";
    private const string SourcesLabel = " Fuentes consultadas: ";
    private const string BuyLinksLabel = " Dónde comprar: ";

    public static string Format(
        string priceRange, string bestValue, string suppliers, IReadOnlyList<string> sources, IReadOnlyList<BudgetBuyLink>? buyLinks = null)
    {
        var summary = $"{RangeLabel}{priceRange}.{BestValueLabel}{bestValue}.{SuppliersLabel}{suppliers}.";
        // Each link as "Store <url>": a URL from Uri.AbsoluteUri never holds < or >, so it splits back cleanly.
        if (buyLinks is { Count: > 0 })
            return $"{summary}{BuyLinksLabel}{string.Join(", ", buyLinks.Select(l => $"{l.Store} <{l.Url}>"))}.";
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
        var buyLinksAt = summary.IndexOf(BuyLinksLabel, suppliersAt, StringComparison.Ordinal);
        var suppliersEnd = sourcesAt >= 0 ? sourcesAt : buyLinksAt >= 0 ? buyLinksAt : summary.Length;

        return new BudgetQuoteBlocks(
            Block(summary[RangeLabel.Length..bestValueAt]),
            Block(summary[(bestValueAt + BestValueLabel.Length)..suppliersAt]),
            Block(summary[(suppliersAt + SuppliersLabel.Length)..suppliersEnd]),
            sourcesAt < 0 ? null : Block(summary[(sourcesAt + SourcesLabel.Length)..]),
            buyLinksAt < 0 ? null : ParseBuyLinks(summary[(buyLinksAt + BuyLinksLabel.Length)..]));
    }

    private static List<BudgetBuyLink> ParseBuyLinks(string text) => BuyLink().Matches(text)
        .Select(m => new BudgetBuyLink(m.Groups["store"].Value.Trim(), m.Groups["url"].Value))
        .ToList();

    [GeneratedRegex(@"(?<store>[^<>,][^<>]*?)\s*<(?<url>https?://[^<>\s]+)>", RegexOptions.None, matchTimeoutMilliseconds: 1000)]
    private static partial Regex BuyLink();

    private static string Block(string text) => text.Trim().TrimEnd('.');
}
