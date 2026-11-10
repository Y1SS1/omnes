using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

// "Describir con IA": proposes a budget from a description. Nothing is saved here; the
// user edits the proposal and saves it with POST /api/budget-projects.
[ApiController]
[Authorize]
[Route("api/budget-drafts")]
public class BudgetDraftsController : ControllerBase
{
    public const int MaxDraftsPerDay = 10;
    public const int MinDescriptionLength = 10;
    public const int MaxDescriptionLength = 500;

    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;
    private readonly IBudgetDrafter _drafter;

    public BudgetDraftsController(AppDbContext db, CurrentUserService currentUser, IBudgetDrafter drafter)
    {
        _db = db;
        _currentUser = currentUser;
        _drafter = drafter;
    }

    [HttpPost]
    public async Task<ActionResult<BudgetDraftDto>> Draft(DraftBudgetRequest req, CancellationToken cancellationToken)
    {
        var description = req.Description?.Trim() ?? string.Empty;
        if (description.Length < MinDescriptionLength)
            return BadRequest($"Describe tu proyecto con al menos {MinDescriptionLength} caracteres.");
        if (description.Length > MaxDescriptionLength)
            return BadRequest($"La descripción no puede superar los {MaxDescriptionLength} caracteres.");
        if (req.TargetAmount is { } target && (target <= 0 || !MoneyValidation.IsWithinRange(target)))
            return BadRequest($"El monto aproximado debe estar entre 1 y {MoneyValidation.MaxAmount:N0}.");

        // Every call spends AI credit, so the attempt counts even if the AI then fails.
        var userId = _currentUser.UserId;
        var usedToday = await _db.AiUsages.CountAsync(u =>
            u.UserId == userId && u.Kind == AiUsage.BudgetDraft && u.CreatedAt >= ChileTime.StartOfTodayUtc(), cancellationToken);
        if (usedToday >= MaxDraftsPerDay)
            return StatusCode(StatusCodes.Status429TooManyRequests,
                $"Llegaste al máximo de {MaxDraftsPerDay} presupuestos generados con IA por día. Intenta de nuevo mañana.");

        _db.AiUsages.Add(new AiUsage { UserId = userId, Kind = AiUsage.BudgetDraft });
        await _db.SaveChangesAsync(cancellationToken);

        IReadOnlyList<BudgetDraftItem> items;
        try
        {
            items = await _drafter.DraftAsync(description, req.TargetAmount, cancellationToken);
        }
        catch (BudgetDraftException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, ex.Message);
        }

        return Ok(new BudgetDraftDto(
            items.Select(i => new BudgetDraftItemDto(i.Name, i.Category, i.Type, i.EstimatedAmount)).ToList(),
            MaxDraftsPerDay - usedToday - 1));
    }
}
