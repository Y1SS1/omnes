using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/budget-projects")]
public partial class BudgetProjectsController : ControllerBase
{
    private const long MaxFileBytes = 5 * 1024 * 1024;
    public const int MaxQuotedProjectsPerDay = 3;
    private const string ExcelContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;
    private readonly IBudgetItemClassifier _classifier;
    private readonly IBudgetItemQuoter _quoter;

    public BudgetProjectsController(
        AppDbContext db, CurrentUserService currentUser, IBudgetItemClassifier classifier, IBudgetItemQuoter quoter)
    {
        _db = db;
        _currentUser = currentUser;
        _classifier = classifier;
        _quoter = quoter;
    }

    // Nothing is saved until both the file and the AI classification succeed, so
    // a failure never leaves a half-imported project behind.
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxFileBytes + 64 * 1024)]
    public async Task<ActionResult<BudgetProjectDto>> Import(
        [FromForm] string? name, IFormFile? file, CancellationToken cancellationToken)
    {
        var projectName = name?.Trim();
        if (string.IsNullOrEmpty(projectName))
            return BadRequest("El nombre del proyecto es obligatorio.");
        if (projectName.Length > BudgetExcelReader.MaxTextLength)
            return BadRequest($"El nombre del proyecto no puede superar los {BudgetExcelReader.MaxTextLength} caracteres.");
        if (file is null || file.Length == 0)
            return BadRequest("Debes subir un archivo Excel.");
        if (file.Length > MaxFileBytes)
            return BadRequest("El archivo no puede superar los 5 MB.");
        if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest("El archivo debe estar en formato .xlsx.");

        BudgetExcelResult excel;
        await using (var stream = file.OpenReadStream())
        {
            excel = BudgetExcelReader.Read(stream);
        }
        if (excel.Errors.Count > 0)
            return BadRequest(string.Join("\n", excel.Errors));

        IReadOnlyList<BudgetItemType> types;
        try
        {
            types = await _classifier.ClassifyAsync(
                excel.Rows.Select(r => new BudgetItemToClassify(r.Name, r.Category)).ToList(), cancellationToken);
        }
        catch (BudgetClassificationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, ex.Message);
        }

        var project = new BudgetProject { UserId = _currentUser.UserId, Name = projectName };
        for (var i = 0; i < excel.Rows.Count; i++)
        {
            var row = excel.Rows[i];
            project.Items.Add(new BudgetItem
            {
                Name = row.Name,
                Type = types[i],
                Category = row.Category,
                EstimatedAmount = row.EstimatedAmount,
            });
        }

        _db.BudgetProjects.Add(project);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(project));
    }

    // Saves a budget from a list the user already reviewed (an AI draft they edited), so no
    // AI runs here; the types are the user's. Same limits as an imported Excel.
    [HttpPost]
    public async Task<ActionResult<BudgetProjectDto>> Create(CreateBudgetProjectRequest req)
    {
        var projectName = req.Name?.Trim();
        if (string.IsNullOrEmpty(projectName))
            return BadRequest("El nombre del proyecto es obligatorio.");
        if (projectName.Length > BudgetExcelReader.MaxTextLength)
            return BadRequest($"El nombre del proyecto no puede superar los {BudgetExcelReader.MaxTextLength} caracteres.");
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest("El presupuesto debe tener al menos un ítem.");
        if (req.Items.Count > BudgetExcelReader.MaxItems)
            return BadRequest($"El presupuesto no puede tener más de {BudgetExcelReader.MaxItems} ítems.");

        var project = new BudgetProject { UserId = _currentUser.UserId, Name = projectName };
        for (var i = 0; i < req.Items.Count; i++)
        {
            var item = req.Items[i];
            var name = item.Name?.Trim() ?? string.Empty;
            var category = item.Category?.Trim() ?? string.Empty;
            var row = $"Ítem {i + 1}";
            if (name.Length == 0) return BadRequest($"{row}: falta el nombre.");
            if (category.Length == 0) return BadRequest($"{row}: falta la categoría.");
            if (name.Length > BudgetExcelReader.MaxTextLength || category.Length > BudgetExcelReader.MaxTextLength)
                return BadRequest($"{row}: el nombre y la categoría no pueden superar los {BudgetExcelReader.MaxTextLength} caracteres.");
            // The JSON enum converter still accepts raw numbers such as 5.
            if (!Enum.IsDefined(item.Type)) return BadRequest($"{row}: el tipo debe ser Asset o Liability.");
            if (!MoneyValidation.IsWithinRange(item.EstimatedAmount))
                return BadRequest($"{row}: el monto debe estar entre 0 y {MoneyValidation.MaxAmount:N0}.");

            project.Items.Add(new BudgetItem
            {
                Name = name,
                Category = category,
                Type = item.Type,
                EstimatedAmount = Math.Round(item.EstimatedAmount, 2),
            });
        }

        _db.BudgetProjects.Add(project);
        await _db.SaveChangesAsync();
        return Ok(ToDto(project));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BudgetProjectSummaryDto>>> List()
    {
        var projects = await _db.BudgetProjects
            .Where(p => p.UserId == _currentUser.UserId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new BudgetProjectSummaryDto(p.Id, p.Name, p.CreatedAt, p.Items.Count))
            .ToListAsync();
        return Ok(projects);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BudgetProjectDto>> Get(Guid id)
    {
        var project = await _db.BudgetProjects
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == _currentUser.UserId);
        if (project is null) return NotFound();
        return Ok(ToDto(project));
    }

    // Lets the user overrule the AI when it classifies an item incorrectly.
    [HttpPatch("{projectId:guid}/items/{itemId:guid}/type")]
    public async Task<ActionResult<BudgetItemDto>> UpdateItemType(Guid projectId, Guid itemId, UpdateBudgetItemTypeRequest req)
    {
        // The JSON enum converter still accepts raw numbers such as 5.
        if (!Enum.IsDefined(req.Type)) return BadRequest("El tipo debe ser Asset o Liability.");

        var item = await _db.BudgetItems.FirstOrDefaultAsync(i =>
            i.Id == itemId && i.BudgetProjectId == projectId && i.BudgetProject!.UserId == _currentUser.UserId);
        if (item is null) return NotFound();

        item.Type = req.Type;
        // Liabilities are never quoted, so an earlier quote no longer applies.
        if (item.Type == BudgetItemType.Liability)
        {
            item.AiQuoteSummary = null;
            item.AiQuotedAt = null;
        }
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    // One item per call: a whole budget takes minutes, longer than one request can
    // safely stay open, and this way every finished quote is already saved.
    [HttpPost("{projectId:guid}/items/{itemId:guid}/quote")]
    public async Task<ActionResult<BudgetItemDto>> QuoteItem(Guid projectId, Guid itemId, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId;
        var item = await _db.BudgetItems.FirstOrDefaultAsync(i =>
            i.Id == itemId && i.BudgetProjectId == projectId && i.BudgetProject!.UserId == userId, cancellationToken);
        if (item is null) return NotFound();

        // Obligations such as rent or electricity keep their amount: only purchases are quoted.
        if (item.Type != BudgetItemType.Asset) return BadRequest("Solo se cotizan los ítems clasificados como activos.");

        // Every quote spends credit, so repeating one on the same day reuses the saved answer.
        var startOfToday = ChileTime.StartOfTodayUtc();
        if (item.AiQuotedAt >= startOfToday) return Ok(ToDto(item));

        // Excludes this project so that a budget already started today can always finish.
        var otherProjectsQuotedToday = await _db.BudgetItems
            .Where(i => i.BudgetProject!.UserId == userId && i.AiQuotedAt >= startOfToday && i.BudgetProjectId != projectId)
            .Select(i => i.BudgetProjectId)
            .Distinct()
            .CountAsync(cancellationToken);
        if (otherProjectsQuotedToday >= MaxQuotedProjectsPerDay)
            return StatusCode(StatusCodes.Status429TooManyRequests,
                $"Llegaste al máximo de {MaxQuotedProjectsPerDay} presupuestos cotizados por día. Intenta de nuevo mañana.");

        try
        {
            item.AiQuoteSummary = await _quoter.QuoteAsync(item.Name, item.Category, cancellationToken);
        }
        catch (BudgetQuoteException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, ex.Message);
        }
        item.AiQuotedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(item));
    }

    [HttpPatch("{id:guid}/name")]
    public async Task<ActionResult<BudgetProjectSummaryDto>> Rename(Guid id, RenameBudgetProjectRequest req)
    {
        var name = req.Name?.Trim();
        if (string.IsNullOrEmpty(name))
            return BadRequest("El nombre del presupuesto es obligatorio.");
        if (name.Length > BudgetExcelReader.MaxTextLength)
            return BadRequest($"El nombre del presupuesto no puede superar los {BudgetExcelReader.MaxTextLength} caracteres.");

        var project = await _db.BudgetProjects
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == _currentUser.UserId);
        if (project is null) return NotFound();

        project.Name = name;
        await _db.SaveChangesAsync();
        return Ok(new BudgetProjectSummaryDto(project.Id, project.Name, project.CreatedAt, project.Items.Count));
    }

    // Deletes the project with its items. If the wallet holds this budget, its copy goes too:
    // a planned budget without its source Excel would have nothing to compare against.
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = _currentUser.UserId;
        var project = await _db.BudgetProjects
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (project is null) return NotFound();

        // Removed explicitly so that it does not depend on the database's cascade rules.
        var plannedCopy = await _db.PlannedItems.Where(i => i.UserId == userId && i.BudgetProjectId == id).ToListAsync();
        _db.PlannedItems.RemoveRange(plannedCopy);
        _db.BudgetItems.RemoveRange(project.Items);
        _db.BudgetProjects.Remove(project);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id:guid}/export")]
    public async Task<IActionResult> Export(Guid id)
    {
        var project = await _db.BudgetProjects
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == _currentUser.UserId);
        if (project is null) return NotFound();

        return File(BudgetExcelWriter.Write(project.OrderedItems()), ExcelContentType, ExportFileName(project.Name));
    }

    private static string ExportFileName(string projectName)
    {
        var safeName = UnsafeFileNameCharacters().Replace(projectName, "").Trim();
        return safeName.Length == 0 ? "Presupuesto actualizado.xlsx" : $"Presupuesto actualizado - {safeName}.xlsx";
    }

    [GeneratedRegex(@"[^\p{L}\p{N} _-]", RegexOptions.None, matchTimeoutMilliseconds: 1000)]
    private static partial Regex UnsafeFileNameCharacters();

    private static BudgetProjectDto ToDto(BudgetProject project) => new(
        project.Id,
        project.Name,
        project.CreatedAt,
        project.OrderedItems().Select(ToDto).ToList());

    private static BudgetItemDto ToDto(BudgetItem item) => new(
        item.Id, item.Name, item.Type, item.Category, item.EstimatedAmount, item.AiQuoteSummary, item.AiQuotedAt,
        BudgetQuoteSummary.Parse(item.AiQuoteSummary));
}
