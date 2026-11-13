using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

// "¿Qué me falta?": the AI reviews a saved budget and suggests what it needs for the goal the
// user writes ("duplicar la venta de papas y pollos").
// Nothing is saved here; the user picks suggestions and adds them with
// POST /api/budget-projects/{id}/items.
[ApiController]
[Authorize]
[Route("api/budget-projects/{projectId:guid}/review")]
public class BudgetReviewsController : ControllerBase
{
    public const int MaxReviewsPerDay = 10;
    public const int MinGoalLength = 5;
    public const int MaxGoalLength = 300;

    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;
    private readonly IBudgetReviewer _reviewer;

    public BudgetReviewsController(AppDbContext db, CurrentUserService currentUser, IBudgetReviewer reviewer)
    {
        _db = db;
        _currentUser = currentUser;
        _reviewer = reviewer;
    }

    [HttpPost]
    public async Task<ActionResult<BudgetReviewDto>> Review(
        Guid projectId, ReviewBudgetRequest? req, CancellationToken cancellationToken)
    {
        // Checked before spending credit: without a goal the AI can only give generic advice.
        var goal = req?.Goal?.Trim() ?? string.Empty;
        if (goal.Length < MinGoalLength)
            return BadRequest("Escribe qué quieres lograr para que la IA te recomiende qué agregar.");
        if (goal.Length > MaxGoalLength)
            return BadRequest($"El objetivo no puede superar los {MaxGoalLength} caracteres.");

        var userId = _currentUser.UserId;
        var project = await _db.BudgetProjects
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == projectId && p.UserId == userId, cancellationToken);
        if (project is null) return NotFound();

        // Checked before spending credit: nothing could be added anyway.
        if (project.Items.Count >= BudgetExcelReader.MaxItems)
            return BadRequest($"El presupuesto ya tiene el máximo de {BudgetExcelReader.MaxItems} ítems.");

        var remaining = await AiDailyLimit.TryUseAsync(
            _db, userId, AiUsage.BudgetReview, MaxReviewsPerDay, cancellationToken);
        if (remaining is null)
            return StatusCode(StatusCodes.Status429TooManyRequests,
                $"Llegaste al máximo de {MaxReviewsPerDay} revisiones con IA por día. Intenta de nuevo mañana.");

        IReadOnlyList<BudgetSuggestion> suggestions;
        try
        {
            suggestions = await _reviewer.ReviewAsync(
                project.Name,
                project.OrderedItems()
                    .Select(i => new BudgetItemToReview(i.Name, i.Category, i.Type, i.EstimatedAmount))
                    .ToList(),
                goal,
                cancellationToken);
        }
        catch (BudgetReviewException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, ex.Message);
        }

        // Never suggest more than the budget still has room for.
        var room = BudgetExcelReader.MaxItems - project.Items.Count;
        return Ok(new BudgetReviewDto(
            suggestions.Take(room)
                .Select(s => new BudgetSuggestionDto(s.Name, s.Category, s.Type, s.EstimatedAmount, s.Reason))
                .ToList(),
            remaining.Value));
    }
}
