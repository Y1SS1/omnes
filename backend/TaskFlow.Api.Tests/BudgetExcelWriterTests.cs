using ClosedXML.Excel;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;
using Xunit;

namespace TaskFlow.Api.Tests;

public class BudgetExcelWriterTests
{
    private const string Summary =
        "Rango: $2.000 - $4.000 CLP por paquete. Mejor precio-calidad: Elite. Proveedores sugeridos: PRISA, Sodimac. Fuentes consultadas: prisa.cl, sodimac.cl.";

    private static BudgetItem Item(string name, BudgetItemType type, string? summary = null, DateTime? quotedAt = null) => new()
    {
        Name = name,
        Type = type,
        Category = "Insumos",
        EstimatedAmount = 20000m,
        AiQuoteSummary = summary,
        AiQuotedAt = quotedAt,
    };

    private static IXLWorksheet Sheet(params BudgetItem[] items) =>
        new XLWorkbook(new MemoryStream(BudgetExcelWriter.Write(items))).Worksheet(1);

    [Fact]
    public void Write_HasTheAgreedHeaders()
    {
        var sheet = Sheet();

        Assert.Equal("Nombre", sheet.Cell(1, 1).GetString());
        Assert.Equal("Categoría", sheet.Cell(1, 2).GetString());
        Assert.Equal("Tipo", sheet.Cell(1, 3).GetString());
        Assert.Equal("Monto estimado", sheet.Cell(1, 4).GetString());
        Assert.Equal("Cotización Nueva", sheet.Cell(1, 5).GetString());
        Assert.Contains("E1:G1", sheet.Cell(1, 5).MergedRange().RangeAddress.ToString());
        Assert.Equal("Rango de precio", sheet.Cell(2, 5).GetString());
        Assert.Equal("Mejor precio-calidad", sheet.Cell(2, 6).GetString());
        Assert.Equal("Proveedores", sheet.Cell(2, 7).GetString());
        Assert.Equal("Fuentes consultadas", sheet.Cell(1, 8).GetString());
        Assert.Equal("Fecha de cotización", sheet.Cell(1, 9).GetString());
    }

    [Fact]
    public void Write_QuotedAsset_SplitsTheQuoteIntoBlocks()
    {
        var sheet = Sheet(Item("Servilletas", BudgetItemType.Asset, Summary, new DateTime(2026, 11, 1, 15, 0, 0, DateTimeKind.Utc)));
        const int row = BudgetExcelWriter.FirstDataRow;

        Assert.Equal("Servilletas", sheet.Cell(row, 1).GetString());
        Assert.Equal("Insumos", sheet.Cell(row, 2).GetString());
        Assert.Equal("Activo", sheet.Cell(row, 3).GetString());
        Assert.Equal(20000d, sheet.Cell(row, 4).GetDouble());
        Assert.Equal("$2.000 - $4.000 CLP por paquete", sheet.Cell(row, 5).GetString());
        Assert.Equal("Elite", sheet.Cell(row, 6).GetString());
        Assert.Equal("PRISA, Sodimac", sheet.Cell(row, 7).GetString());
        Assert.Equal("prisa.cl, sodimac.cl", sheet.Cell(row, 8).GetString());
        Assert.Equal(new DateTime(2026, 11, 1), sheet.Cell(row, 9).GetDateTime());
    }

    [Fact]
    public void Write_DateIsTheDayInChile()
    {
        // Already the 2nd in UTC, but still the night of the 1st in Chile.
        var sheet = Sheet(Item("Servilletas", BudgetItemType.Asset, Summary, new DateTime(2026, 11, 2, 1, 0, 0, DateTimeKind.Utc)));

        Assert.Equal(new DateTime(2026, 11, 1), sheet.Cell(BudgetExcelWriter.FirstDataRow, 9).GetDateTime());
    }

    [Fact]
    public void Write_Liability_IsMarkedAsNotQuotable()
    {
        var sheet = Sheet(Item("Luz", BudgetItemType.Liability));
        const int row = BudgetExcelWriter.FirstDataRow;

        Assert.Equal("Pasivo", sheet.Cell(row, 3).GetString());
        Assert.Equal("No se cotiza", sheet.Cell(row, 5).GetString());
        Assert.Equal("No se cotiza", sheet.Cell(row, 6).GetString());
        Assert.Equal("No se cotiza", sheet.Cell(row, 7).GetString());
        Assert.True(sheet.Cell(row, 9).IsEmpty());
    }

    [Fact]
    public void Write_AssetNotQuotedYet_IsMarkedAsPending()
    {
        var sheet = Sheet(Item("Harina", BudgetItemType.Asset));

        Assert.Equal("Sin cotizar", sheet.Cell(BudgetExcelWriter.FirstDataRow, 5).GetString());
    }

    [Fact]
    public void Write_TextThatDoesNotSplit_IsKeptWhole()
    {
        var sheet = Sheet(Item("Harina", BudgetItemType.Asset, "Texto libre", new DateTime(2026, 11, 1, 15, 0, 0, DateTimeKind.Utc)));

        Assert.Equal("Texto libre", sheet.Cell(BudgetExcelWriter.FirstDataRow, 5).GetString());
    }

    [Fact]
    public void Write_FormulaLikeText_StaysAsText()
    {
        var sheet = Sheet(Item("=HYPERLINK(\"http://malo\")", BudgetItemType.Asset));
        var cell = sheet.Cell(BudgetExcelWriter.FirstDataRow, 1);

        Assert.False(cell.HasFormula);
        Assert.Equal("=HYPERLINK(\"http://malo\")", cell.GetString());
    }

    [Fact]
    public void Parse_WithoutSources_LeavesThemEmpty()
    {
        var blocks = BudgetQuoteSummary.Parse("Rango: $1.000 CLP. Mejor precio-calidad: Marca. Proveedores sugeridos: Lider.");

        Assert.NotNull(blocks);
        Assert.Equal("$1.000 CLP", blocks.PriceRange);
        Assert.Equal("Lider", blocks.Suppliers);
        Assert.Null(blocks.Sources);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Texto libre")]
    [InlineData("Rango: $1 CLP. Proveedores sugeridos: Lider.")]
    public void Parse_WithOtherText_ReturnsNull(string? summary)
    {
        Assert.Null(BudgetQuoteSummary.Parse(summary));
    }

    [Fact]
    public void Format_AndParse_RoundTrip()
    {
        var text = BudgetQuoteSummary.Format("$2.000 - $4.000 CLP", "Elite", "PRISA, Sodimac", ["prisa.cl", "sodimac.cl"]);

        Assert.Equal(new BudgetQuoteBlocks("$2.000 - $4.000 CLP", "Elite", "PRISA, Sodimac", "prisa.cl, sodimac.cl"), BudgetQuoteSummary.Parse(text));
    }
}
