using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Tests;

public class FoundryBudgetDrafterTests
{
    private static string Item(string name, string category = "Cocina", string type = "Asset", long amount = 100_000) =>
        $$"""{"name":"{{name}}","category":"{{category}}","type":"{{type}}","estimatedAmount":{{amount}}}""";

    private static string Answer(params string[] items) => $$"""{"items":[{{string.Join(",", items)}}]}""";

    [Fact]
    public void ParseResponse_ReadsEveryItem()
    {
        var items = FoundryBudgetDrafter.ParseResponse(Answer(
            Item("Freidora industrial 2 canastos", amount: 650_000),
            Item("Arriendo del local (mensual)", "Gastos fijos", "Liability", 850_000)));

        Assert.Equal(2, items.Count);
        Assert.Equal(new BudgetDraftItem("Freidora industrial 2 canastos", "Cocina", BudgetItemType.Asset, 650_000m), items[0]);
        Assert.Equal(BudgetItemType.Liability, items[1].Type);
    }

    [Fact]
    public void ParseResponse_DropsBlankRepeatedAndNegativeItems()
    {
        var items = FoundryBudgetDrafter.ParseResponse(Answer(
            Item("  "),
            Item("Freidora"),
            Item("freidora"),
            Item("Mesa", amount: -5)));

        Assert.Equal("Freidora", Assert.Single(items).Name);
    }

    [Fact]
    public void ParseResponse_TrimsAndFillsAMissingCategory()
    {
        var item = Assert.Single(FoundryBudgetDrafter.ParseResponse(Answer(Item("  Horno  ", category: " "))));

        Assert.Equal("Horno", item.Name);
        Assert.Equal("General", item.Category);
    }

    [Fact]
    public void ParseResponse_ClipsLongNames()
    {
        var item = Assert.Single(FoundryBudgetDrafter.ParseResponse(Answer(Item(new string('a', 300)))));

        Assert.Equal(BudgetExcelReader.MaxTextLength, item.Name.Length);
    }

    [Fact]
    public void ParseResponse_KeepsAtMostThirtyItems()
    {
        var many = Enumerable.Range(1, 40).Select(i => Item($"Ítem {i}")).ToArray();

        Assert.Equal(FoundryBudgetDrafter.MaxItems, FoundryBudgetDrafter.ParseResponse(Answer(many)).Count);
    }

    [Theory]
    [InlineData("""{"items":[]}""")]
    [InlineData("""{"other":1}""")]
    [InlineData("not json")]
    public void ParseResponse_WithNothingUsable_Throws(string json)
    {
        Assert.Throws<BudgetDraftException>(() => FoundryBudgetDrafter.ParseResponse(json));
    }
}
