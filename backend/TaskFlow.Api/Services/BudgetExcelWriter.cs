using ClosedXML.Excel;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

// Writes the updated budget: one row per item, with the quote split into blocks
// under a shared "Cotización Nueva" header.
public static class BudgetExcelWriter
{
    public const int FirstDataRow = 3;

    private const string NotQuotable = "No se cotiza";
    private const string NotQuotedYet = "Sin cotizar";

    private static readonly string[] SingleHeaders = ["Nombre", "Categoría", "Tipo", "Monto estimado"];
    private static readonly double[] ColumnWidths = [28, 16, 10, 16, 28, 30, 36, 40, 14];

    public static byte[] Write(IEnumerable<BudgetItem> orderedItems)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Presupuesto");

        WriteHeaders(sheet);

        var row = FirstDataRow;
        foreach (var item in orderedItems)
            WriteItem(sheet, row++, item);

        for (var i = 0; i < ColumnWidths.Length; i++)
            sheet.Column(i + 1).Width = ColumnWidths[i];

        var data = sheet.Range(FirstDataRow, 1, Math.Max(row - 1, FirstDataRow), ColumnWidths.Length);
        data.Style.Alignment.WrapText = true;
        data.Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;

        sheet.SheetView.FreezeRows(FirstDataRow - 1);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static void WriteHeaders(IXLWorksheet sheet)
    {
        for (var i = 0; i < SingleHeaders.Length; i++)
            MergedHeader(sheet, 1, i + 1, 2, i + 1, SingleHeaders[i]);

        MergedHeader(sheet, 1, 5, 1, 7, "Cotización Nueva");
        sheet.Cell(2, 5).Value = "Rango de precio";
        sheet.Cell(2, 6).Value = "Mejor precio-calidad";
        sheet.Cell(2, 7).Value = "Proveedores";

        MergedHeader(sheet, 1, 8, 2, 8, "Fuentes consultadas");
        MergedHeader(sheet, 1, 9, 2, 9, "Fecha de cotización");

        var headers = sheet.Range(1, 1, 2, ColumnWidths.Length);
        headers.Style.Font.Bold = true;
        headers.Style.Fill.BackgroundColor = XLColor.FromHtml("#E5E7EB");
        headers.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        headers.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        headers.Style.Alignment.WrapText = true;
        headers.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        headers.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
    }

    private static void MergedHeader(IXLWorksheet sheet, int firstRow, int firstColumn, int lastRow, int lastColumn, string text)
    {
        sheet.Cell(firstRow, firstColumn).Value = text;
        sheet.Range(firstRow, firstColumn, lastRow, lastColumn).Merge();
    }

    private static void WriteItem(IXLWorksheet sheet, int row, BudgetItem item)
    {
        sheet.Cell(row, 1).Value = item.Name;
        sheet.Cell(row, 2).Value = item.Category;
        sheet.Cell(row, 3).Value = item.Type == BudgetItemType.Asset ? "Activo" : "Pasivo";

        var amount = sheet.Cell(row, 4);
        amount.Value = item.EstimatedAmount;
        amount.Style.NumberFormat.Format = "$#,##0";

        if (item.Type != BudgetItemType.Asset)
        {
            WriteQuoteBlocks(sheet, row, NotQuotable, NotQuotable, NotQuotable);
            return;
        }
        if (item.AiQuoteSummary is null)
        {
            WriteQuoteBlocks(sheet, row, NotQuotedYet, NotQuotedYet, NotQuotedYet);
            return;
        }

        // Text that does not split into blocks still reaches the user rather than being lost.
        var blocks = BudgetQuoteSummary.Parse(item.AiQuoteSummary);
        if (blocks is null)
        {
            sheet.Cell(row, 5).Value = item.AiQuoteSummary;
        }
        else
        {
            WriteQuoteBlocks(sheet, row, blocks.PriceRange, blocks.BestValue, blocks.Suppliers);
            sheet.Cell(row, 8).Value = blocks.Sources ?? "";
        }

        if (item.AiQuotedAt is { } quotedAt)
        {
            var date = sheet.Cell(row, 9);
            date.Value = ChileTime.ToLocal(quotedAt).Date;
            date.Style.DateFormat.Format = "dd-mm-yyyy";
        }
    }

    private static void WriteQuoteBlocks(IXLWorksheet sheet, int row, string priceRange, string bestValue, string suppliers)
    {
        sheet.Cell(row, 5).Value = priceRange;
        sheet.Cell(row, 6).Value = bestValue;
        sheet.Cell(row, 7).Value = suppliers;
    }
}
