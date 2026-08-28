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
[Route("api/savings")]
public class SavingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;

    public SavingsController(AppDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // A named goal (e.g. "Cambio de maquinaria") with its own target + deadline.
    [HttpGet("goals")]
    public async Task<ActionResult<List<SavingsGoalDto>>> GetGoals()
    {
        var goals = await _db.SavingsGoals
            .Where(g => g.UserId == _currentUser.UserId)
            .OrderBy(g => g.CreatedAt)
            .ToListAsync();
        var goalIds = goals.Select(g => g.Id).ToList();

        var saved = await _db.SavingsMovements
            .Where(m => goalIds.Contains(m.SavingsGoalId!.Value))
            .GroupBy(m => m.SavingsGoalId!.Value)
            .Select(g => new { GoalId = g.Key, Total = g.Sum(m => m.Amount) })
            .ToDictionaryAsync(x => x.GoalId, x => x.Total);

        return goals.Select(g => ToDto(g, saved.TryGetValue(g.Id, out var s) ? s : 0)).ToList();
    }

    [HttpPost("goals")]
    public async Task<ActionResult<SavingsGoalDto>> CreateGoal(CreateSavingsGoalRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("El nombre es obligatorio.");
        if (req.TargetAmount <= 0 || req.TargetMonths <= 0) return BadRequest("La meta y el plazo deben ser mayores a 0.");
        if (!MoneyValidation.IsWithinRange(req.TargetAmount))
            return BadRequest($"El monto es demasiado grande. El máximo permitido es {MoneyValidation.MaxAmount:N0}.");

        var goal = new SavingsGoal
        {
            UserId = _currentUser.UserId,
            Name = req.Name.Trim(),
            TargetAmount = req.TargetAmount,
            TargetMonths = req.TargetMonths
        };
        _db.SavingsGoals.Add(goal);
        await _db.SaveChangesAsync();
        return Ok(ToDto(goal, 0));
    }

    // Deletes the goal label only - money already allocated stays in the fund,
    // it just becomes unassigned (see SetNull in AppDbContext).
    [HttpDelete("goals/{id}")]
    public async Task<IActionResult> DeleteGoal(Guid id)
    {
        var goal = await _db.SavingsGoals.FirstOrDefaultAsync(g => g.Id == id && g.UserId == _currentUser.UserId);
        if (goal is null) return NotFound();
        _db.SavingsGoals.Remove(goal);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // US-17: separates money from the spendable balance into the untouchable savings fund,
    // optionally earmarked toward one named goal.
    [HttpPost("allocate")]
    public async Task<IActionResult> Allocate(AllocateSavingsRequest req)
    {
        if (req.Amount <= 0) return BadRequest("El monto debe ser mayor a 0.");
        if (!MoneyValidation.IsWithinRange(req.Amount))
            return BadRequest($"El monto es demasiado grande. El máximo permitido es {MoneyValidation.MaxAmount:N0}.");

        var wallet = await _db.Wallets.FirstOrDefaultAsync(w => w.UserId == _currentUser.UserId);
        if (wallet is null) return NotFound();
        if (wallet.Balance < req.Amount) return BadRequest("Saldo disponible insuficiente.");

        if (req.SavingsGoalId.HasValue)
        {
            var goalExists = await _db.SavingsGoals.AnyAsync(g => g.Id == req.SavingsGoalId && g.UserId == _currentUser.UserId);
            if (!goalExists) return BadRequest("Meta de ahorro no encontrada.");
        }

        wallet.Balance -= req.Amount;
        wallet.SavingsFund += req.Amount;
        _db.SavingsMovements.Add(new SavingsMovement
        {
            UserId = _currentUser.UserId,
            Amount = req.Amount,
            Note = req.Note,
            SavingsGoalId = req.SavingsGoalId
        });

        await _db.SaveChangesAsync();
        return Ok(new WalletDto(wallet.Balance, wallet.SavingsFund));
    }

    [HttpGet("movements")]
    public async Task<ActionResult<List<SavingsMovementDto>>> GetMovements([FromQuery] Guid? goalId)
    {
        var query = _db.SavingsMovements.Where(s => s.UserId == _currentUser.UserId);
        if (goalId.HasValue) query = query.Where(s => s.SavingsGoalId == goalId);
        var items = await query.OrderByDescending(s => s.Date).ToListAsync();
        return items.Select(s => new SavingsMovementDto(s.Id, s.Amount, s.Date, s.Note, s.SavingsGoalId)).ToList();
    }

    private static SavingsGoalDto ToDto(SavingsGoal g, decimal saved) => new(
        g.Id, g.Name, g.TargetAmount, g.TargetMonths,
        Math.Round(g.TargetAmount / g.TargetMonths, 2, MidpointRounding.AwayFromZero),
        saved, g.CreatedAt
    );
}
