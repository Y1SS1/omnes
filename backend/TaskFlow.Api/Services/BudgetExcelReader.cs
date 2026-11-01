using System.Globalization;
using System.Text;
using ClosedXML.Excel;

namespace TaskFlow.Api.Services;

public record BudgetExcelRow(int RowNumber, string Name, string Category, decimal EstimatedAmount);

public record BudgetExcelResult(IReadOnlyList<BudgetExcelRow> Rows, IReadOnlyList<string> Errors);

// Reads the fixed budget template: first worksheet, headers in row 1
// (Nombre | Categoría | Monto estimado), one item per row after that.
public static class BudgetExcelReader
{
    public const int MaxItems = 50;
    public const int MaxTextLength = 200;

    private const string NameHeader = "nombre";
    private const string CategoryHeader = "categoria";
    private const string AmountHeader = "monto estimado";

    public static BudgetExcelResult Read(Stream stream)
    {
        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(stream);
        }
        catch (Exception)
        {
            // ClosedXML surfaces a corrupt or non-xlsx file through several
            // unrelated exception types; to the user they all mean the same thing.
            return Failure("El archivo no es un Excel .xlsx válido.");
        }

        using (workbook)
        {
            var sheet = workbook.Worksheets.First();
            var columns = FindColumns(sheet);
            var missing = new[] { NameHeader, CategoryHeader, AmountHeader }.Where(h => !columns.ContainsKey(h)).ToList();
            if (missing.Count > 0)
                return Failure("El Excel debe tener en la primera fila las columnas: Nombre, Categoría y Monto estimado.");

            var rows = new List<BudgetExcelRow>();
            var errors = new List<string>();
            var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 1;

            for (var rowNumber = 2; rowNumber <= lastRow; rowNumber++)
            {
                var nameCell = sheet.Cell(rowNumber, columns[NameHeader]);
                var categoryCell = sheet.Cell(rowNumber, columns[CategoryHeader]);
                var amountCell = sheet.Cell(rowNumber, columns[AmountHeader]);
                if (nameCell.IsEmpty() && categoryCell.IsEmpty() && amountCell.IsEmpty()) continue;

                if (rows.Count + errors.Count >= MaxItems)
                    return Failure($"El Excel no puede tener más de {MaxItems} ítems.");

                var row = ReadRow(rowNumber, nameCell, categoryCell, amountCell, out var error);
                if (row is null) errors.Add(error!);
                else rows.Add(row);
            }

            if (errors.Count == 0 && rows.Count == 0)
                return Failure("El Excel no tiene ítems.");

            return errors.Count > 0
                ? new BudgetExcelResult(Array.Empty<BudgetExcelRow>(), errors)
                : new BudgetExcelResult(rows, errors);
        }
    }

    private static BudgetExcelRow? ReadRow(int rowNumber, IXLCell nameCell, IXLCell categoryCell, IXLCell amountCell, out string? error)
    {
        var nameProblem = ReadText(nameCell, "el nombre", out var name);
        var categoryProblem = ReadText(categoryCell, "la categoría", out var category);
        var amountProblem = ReadAmount(amountCell, out var amount);

        var problem = nameProblem ?? categoryProblem ?? amountProblem;
        if (problem is not null)
        {
            error = $"Fila {rowNumber}: {problem}";
            return null;
        }

        error = null;
        return new BudgetExcelRow(rowNumber, name, category, amount);
    }

    private static string? ReadText(IXLCell cell, string label, out string text)
    {
        text = string.Empty;
        if (!TryGetValue(cell, out var value) || value.IsError) return $"{label} tiene un valor inválido.";

        text = value.IsBlank ? string.Empty : value.ToString(CultureInfo.InvariantCulture).Trim();
        if (text.Length == 0) return $"falta {label}.";
        if (text.Length > MaxTextLength) return $"{label} supera los {MaxTextLength} caracteres.";
        return null;
    }

    private static string? ReadAmount(IXLCell cell, out decimal amount)
    {
        amount = 0;
        if (!TryGetValue(cell, out var value) || value.IsError) return "el monto tiene un valor inválido.";
        if (value.IsBlank) return "falta el monto.";
        if (!value.IsNumber) return "el monto debe ser un número.";

        var number = value.GetNumber();
        if (number < 0 || number > (double)MoneyValidation.MaxAmount)
            return $"el monto debe estar entre 0 y {MoneyValidation.MaxAmount:N0}.";

        amount = Math.Round((decimal)number, 2);
        return null;
    }

    // Reading a formula cell evaluates it, which throws for functions ClosedXML
    // doesn't implement. That is a bad cell, not a server error.
    private static bool TryGetValue(IXLCell cell, out XLCellValue value)
    {
        try
        {
            value = cell.Value;
            return true;
        }
        catch (Exception)
        {
            value = default;
            return false;
        }
    }

    private static Dictionary<string, int> FindColumns(IXLWorksheet sheet)
    {
        var columns = new Dictionary<string, int>();
        foreach (var cell in sheet.Row(1).CellsUsed())
        {
            if (!TryGetValue(cell, out var value) || !value.IsText) continue;
            columns.TryAdd(NormalizeHeader(value.GetText()), cell.Address.ColumnNumber);
        }
        return columns;
    }

    // "Categoría", "CATEGORIA " and "categoria" are the same header.
    private static string NormalizeHeader(string header)
    {
        var withoutAccents = new StringBuilder();
        foreach (var c in header.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                withoutAccents.Append(c);
        }
        return withoutAccents.ToString();
    }

    private static BudgetExcelResult Failure(string error) =>
        new(Array.Empty<BudgetExcelRow>(), new[] { error });
}
