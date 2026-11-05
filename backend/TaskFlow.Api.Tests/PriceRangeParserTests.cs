using TaskFlow.Api.Services;

namespace TaskFlow.Api.Tests;

public class PriceRangeParserTests
{
    [Theory]
    // Real ranges written by the AI in the app.
    [InlineData("CLP 280.000 - CLP 350.000", 280_000, 350_000)]
    [InlineData("$400.000 - $600.000 CLP", 400_000, 600_000)]
    [InlineData("$12.000.000 - $20.000.000 CLP por unidad", 12_000_000, 20_000_000)]
    [InlineData("CLP $110.000 - $170.000", 110_000, 170_000)]
    [InlineData("$80.000 - $140.000 CLP por set (mesa + 4 sillas)", 80_000, 140_000)]
    // Order, decimals and amounts without thousands separators.
    [InlineData("$350.000 - $280.000", 280_000, 350_000)]
    [InlineData("Entre 1500 y 2500 pesos", 1_500, 2_500)]
    [InlineData("$990 - $1.290", 990, 1_290)]
    public void Parse_ReadsMinAndMax(string text, int min, int max)
    {
        var range = PriceRangeParser.Parse(text);

        Assert.NotNull(range);
        Assert.Equal(min, range.Min);
        Assert.Equal(max, range.Max);
    }

    [Fact]
    public void Parse_WithASinglePrice_UsesItAsMinAndMax()
    {
        var range = PriceRangeParser.Parse("Desde $45.000 CLP");

        Assert.Equal(new PriceRange(45_000, 45_000), range);
    }

    [Fact]
    public void Parse_IgnoresQuantitiesBeforeThePrices()
    {
        var range = PriceRangeParser.Parse("Freidora de 2 canastos: $400.000 - $600.000");

        Assert.Equal(new PriceRange(400_000, 600_000), range);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Sin precios publicados")]
    [InlineData("USD 300 - USD 450")]
    [InlineData("€ 250 - € 300")]
    public void Parse_WithoutChileanPesos_ReturnsNull(string? text)
    {
        Assert.Null(PriceRangeParser.Parse(text));
    }
}
