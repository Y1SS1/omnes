using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Tests;

public class FoundryBudgetReviewerTests
{
    private static string Suggestion(
        string name, string category = "Permisos", string type = "Liability", long amount = 100_000, string reason = "Obligatorio") =>
        $$"""{"name":"{{name}}","category":"{{category}}","type":"{{type}}","estimatedAmount":{{amount}},"reason":"{{reason}}"}""";

    private static string Answer(params string[] suggestions) => $$"""{"suggestions":[{{string.Join(",", suggestions)}}]}""";

    [Fact]
    public void ParseResponse_ReadsEverySuggestionWithItsReason()
    {
        var suggestions = FoundryBudgetReviewer.ParseResponse(Answer(
            Suggestion("Resolución sanitaria", reason: "Obligatoria para vender alimentos"),
            Suggestion("Extintor PQS 6 kg", "Seguridad", "Asset", 35_000)), []);

        Assert.Equal(2, suggestions.Count);
        Assert.Equal(
            new BudgetSuggestion("Resolución sanitaria", "Permisos", BudgetItemType.Liability, 100_000m, "Obligatoria para vender alimentos"),
            suggestions[0]);
        Assert.Equal(BudgetItemType.Asset, suggestions[1].Type);
    }

    [Fact]
    public void ParseResponse_DropsWhatTheBudgetAlreadyHasAndRepeats()
    {
        var suggestions = FoundryBudgetReviewer.ParseResponse(Answer(
            Suggestion("freidora industrial"),
            Suggestion("Extintor"),
            Suggestion("EXTINTOR"),
            Suggestion("  "),
            Suggestion("Mesa", amount: -5)), ["Freidora industrial "]);

        Assert.Equal("Extintor", Assert.Single(suggestions).Name);
    }

    [Fact]
    public void ParseResponse_AcceptsAnEmptyListAsNothingMissing()
    {
        Assert.Empty(FoundryBudgetReviewer.ParseResponse(Answer(), ["Horno"]));
    }

    [Fact]
    public void ParseResponse_KeepsAtMostTenSuggestions()
    {
        var many = Enumerable.Range(1, 15).Select(i => Suggestion($"Ítem {i}")).ToArray();

        Assert.Equal(FoundryBudgetReviewer.MaxSuggestions, FoundryBudgetReviewer.ParseResponse(Answer(many), []).Count);
    }

    [Theory]
    [InlineData("no es json")]
    [InlineData("{}")]
    public void ParseResponse_WithAnUnusableAnswer_Throws(string json)
    {
        Assert.Throws<BudgetReviewException>(() => FoundryBudgetReviewer.ParseResponse(json, []));
    }
}
