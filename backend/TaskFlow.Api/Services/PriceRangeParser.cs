using System.Globalization;
using System.Text.RegularExpressions;

namespace TaskFlow.Api.Services;

public record PriceRange(decimal Min, decimal Max);

// Reads the Chilean-peso amounts out of the AI's free-text price range, such as
// "CLP 280.000 - CLP 350.000" or "$12.000.000 - $20.000.000 CLP por unidad".
// Dots group thousands and a comma starts the decimals, as written in Chile.
public static partial class PriceRangeParser
{
    private static readonly string[] ForeignCurrencyMarkers = ["USD", "US$", "EUR", "€", "U$S"];

    public static PriceRange? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        if (ForeignCurrencyMarkers.Any(m => text.Contains(m, StringComparison.OrdinalIgnoreCase))) return null;

        var amounts = new List<decimal>();
        foreach (Match match in Amount().Matches(text))
        {
            var digits = match.Groups["int"].Value;
            var grouped = digits.Contains('.');
            var afterCurrencySign = match.Groups["sign"].Success;
            var value = decimal.Parse(digits.Replace(".", ""), CultureInfo.InvariantCulture);
            // A bare small number is a quantity ("4 sillas", "2 canastos"), not a price.
            if (!grouped && !afterCurrencySign && value < 1000) continue;
            amounts.Add(value);
            if (amounts.Count == 2) break;
        }

        return amounts.Count switch
        {
            0 => null,
            1 => new PriceRange(amounts[0], amounts[0]),
            _ => new PriceRange(Math.Min(amounts[0], amounts[1]), Math.Max(amounts[0], amounts[1])),
        };
    }

    [GeneratedRegex(@"(?<sign>\$\s?)?(?<![\d.,])(?<int>\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?(?![\d])",
        RegexOptions.None, matchTimeoutMilliseconds: 1000)]
    private static partial Regex Amount();
}
