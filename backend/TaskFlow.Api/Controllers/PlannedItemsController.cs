using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

// The wallet's "Presupuesto planificado": editable copies of the items of one imported Excel.
// Only one budget is planned at a time, so totals and the balance comparison stay meaningful.
[ApiController]
[Authorize]
[Route("api/planned-items")]
public class PlannedItemsController : ControllerBase
{
    public const int MaxTextLength = BudgetExcelReader.MaxTextLength;

    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;

    public PlannedItemsController(AppDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlannedItemDto>>> List()
    {
        var items = await _db.PlannedItems
            .Where(i => i.UserId == _currentUser.UserId)
            .OrderByDescending(i => i.BudgetProject!.CreatedAt)
            .ThenBy(i => i.Type)
            .ThenBy(i => i.Name)
            .Select(i => new PlannedItemDto(
                i.Id, i.BudgetProjectId, i.BudgetProject!.Name, i.Name, i.Category, i.Type, i.Amount, i.CreatedAt))
            .ToListAsync();
        return Ok(items);
    }

    // Copies the project's items with the amount from the Excel, replacing whatever budget
    // the wallet held before (the same project or another one).
    [HttpPost("from-project/{projectId:guid}")]
    public async Task<ActionResult<IReadOnlyList<PlannedItemDto>>> TransferFromProject(Guid projectId)
    {
        var userId = _currentUser.UserId;
        var project = await _db.BudgetProjects
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == projectId && p.UserId == userId);
        if (project is null) return NotFound();

        var previous = await _db.PlannedItems
            .Where(i => i.UserId == userId)
            .ToListAsync();
        _db.PlannedItems.RemoveRange(previous);

        var copies = project.OrderedItems()
            .Select(item => new PlannedItem
            {
                UserId = userId,
                BudgetProjectId = project.Id,
                Name = item.Name,
                Category = item.Category,
                Type = item.Type,
                Amount = item.EstimatedAmount,
            })
            .ToList();
        _db.PlannedItems.AddRange(copies);
        await _db.SaveChangesAsync();

        return Ok(copies.Select(c => ToDto(c, project.Name)).ToList());
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PlannedItemDto>> Update(Guid id, UpdatePlannedItemRequest req)
    {
        var name = req.Name?.Trim() ?? string.Empty;
        var category = req.Category?.Trim() ?? string.Empty;
        if (name.Length == 0) return BadRequest("El nombre es obligatorio.");
        if (category.Length == 0) return BadRequest("La categoría es obligatoria.");
        if (name.Length > MaxTextLength || category.Length > MaxTextLength)
            return BadRequest($"El nombre y la categoría no pueden superar los {MaxTextLength} caracteres.");
        // The JSON enum converter still accepts raw numbers such as 5.
        if (!Enum.IsDefined(req.Type)) return BadRequest("El tipo debe ser Asset o Liability.");
        if (!MoneyValidation.IsWithinRange(req.Amount))
            return BadRequest($"El monto debe estar entre 0 y {MoneyValidation.MaxAmount:N0}.");

        var item = await _db.PlannedItems
            .Include(i => i.BudgetProject)
            .FirstOrDefaultAsync(i => i.Id == id && i.UserId == _currentUser.UserId);
        if (item is null) return NotFound();

        item.Name = name;
        item.Category = category;
        item.Type = req.Type;
        item.Amount = Math.Round(req.Amount, 2);
        await _db.SaveChangesAsync();
        return Ok(ToDto(item, item.BudgetProject!.Name));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var item = await _db.PlannedItems.FirstOrDefaultAsync(i => i.Id == id && i.UserId == _currentUser.UserId);
        if (item is null) return NotFound();
        _db.PlannedItems.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static PlannedItemDto ToDto(PlannedItem item, string projectName) => new(
        item.Id, item.BudgetProjectId, projectName, item.Name, item.Category, item.Type, item.Amount, item.CreatedAt);
}
