using ClosedXML.Excel;
using TaskFlow.Api.Services;
using Xunit;

namespace TaskFlow.Api.Tests;

public class BudgetExcelReaderTests
{
    [Fact]
    public void Read_ValidTemplate_ReturnsRows()
    {
        using var stream = TestHelpers.NewBudgetExcel(
            ["Nombre", "Categoría", "Monto estimado"],
            ["Carne", "Insumos", 150000],
            ["Arriendo local", "Arriendo", 800000.5]);

        var result = BudgetExcelReader.Read(stream);

        Assert.Empty(result.Errors);
        Assert.Equal(2, result.Rows.Count);
        Assert.Equal(new BudgetExcelRow(2, "Carne", "Insumos", 150000m), result.Rows[0]);
        Assert.Equal(800000.5m, result.Rows[1].EstimatedAmount);
    }

    [Fact]
    public void Read_HeadersInAnyOrderCaseAndAccents_AreRecognized()
    {
        using var stream = TestHelpers.NewBudgetExcel(
            ["MONTO ESTIMADO", " categoria ", "nombre"],
            [1000, "Insumos", "Pan"]);

        var result = BudgetExcelReader.Read(stream);

        Assert.Empty(result.Errors);
        Assert.Equal(new BudgetExcelRow(2, "Pan", "Insumos", 1000m), Assert.Single(result.Rows));
    }

    [Fact]
    public void Read_WithMissingColumn_ReturnsError()
    {
        using var stream = TestHelpers.NewBudgetExcel(["Nombre", "Monto estimado"], ["Carne", 1000]);

        var result = BudgetExcelReader.Read(stream);

        Assert.Contains("Categoría", Assert.Single(result.Errors));
    }

    [Fact]
    public void Read_SkipsBlankRows()
    {
        using var stream = TestHelpers.NewBudgetExcel(
            ["Nombre", "Categoría", "Monto estimado"],
            ["Carne", "Insumos", 1000],
            [null, null, null],
            ["Pan", "Insumos", 500]);

        var result = BudgetExcelReader.Read(stream);

        Assert.Empty(result.Errors);
        Assert.Equal(new[] { 2, 4 }, result.Rows.Select(r => r.RowNumber));
    }

    [Fact]
    public void Read_WithInvalidRows_ReportsEveryRowAndReturnsNoItems()
    {
        using var stream = TestHelpers.NewBudgetExcel(
            ["Nombre", "Categoría", "Monto estimado"],
            ["Carne", "Insumos", 1000],
            [null, "Insumos", 1000],
            ["Pan", null, 1000],
            ["Sal", "Insumos", "mucho"],
            ["Agua", "Insumos", -1],
            ["Luz", "Servicios", null]);

        var result = BudgetExcelReader.Read(stream);

        Assert.Empty(result.Rows);
        Assert.Equal(5, result.Errors.Count);
        Assert.StartsWith("Fila 3: falta el nombre", result.Errors[0]);
        Assert.StartsWith("Fila 4: falta la categoría", result.Errors[1]);
        Assert.StartsWith("Fila 5: el monto debe ser un número", result.Errors[2]);
        Assert.StartsWith("Fila 6: el monto debe estar entre", result.Errors[3]);
        Assert.StartsWith("Fila 7: falta el monto", result.Errors[4]);
    }

    [Fact]
    public void Read_WithNoItems_ReturnsError()
    {
        using var stream = TestHelpers.NewBudgetExcel(["Nombre", "Categoría", "Monto estimado"]);

        var result = BudgetExcelReader.Read(stream);

        Assert.Equal("El Excel no tiene ítems.", Assert.Single(result.Errors));
    }

    [Fact]
    public void Read_OverItemLimit_ReturnsError()
    {
        var rows = Enumerable.Range(0, BudgetExcelReader.MaxItems + 1)
            .Select(i => new object?[] { $"Item {i}", "Insumos", 1000 });
        using var stream = TestHelpers.NewBudgetExcel(
            new object?[][] { ["Nombre", "Categoría", "Monto estimado"] }.Concat(rows).ToArray());

        var result = BudgetExcelReader.Read(stream);

        Assert.Empty(result.Rows);
        Assert.Contains("más de 50", Assert.Single(result.Errors));
    }

    [Fact]
    public void Read_WithFormulaAmount_UsesCalculatedValue()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Presupuesto");
        sheet.Cell(1, 1).Value = "Nombre";
        sheet.Cell(1, 2).Value = "Categoría";
        sheet.Cell(1, 3).Value = "Monto estimado";
        sheet.Cell(2, 1).Value = "Carne";
        sheet.Cell(2, 2).Value = "Insumos";
        sheet.Cell(2, 3).FormulaA1 = "=100*5";
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        var result = BudgetExcelReader.Read(stream);

        Assert.Empty(result.Errors);
        Assert.Equal(500m, Assert.Single(result.Rows).EstimatedAmount);
    }

    [Fact]
    public void Read_NotAnExcelFile_ReturnsError()
    {
        using var stream = new MemoryStream("esto no es un excel"u8.ToArray());

        var result = BudgetExcelReader.Read(stream);

        Assert.Contains(".xlsx", Assert.Single(result.Errors));
    }
}
