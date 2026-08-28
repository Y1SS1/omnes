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

    // US-17: separates money from the spendable balance into the untouchable savings fund.
    [HttpPost("allocate")]
    public async Task<IActionResult> Allocate(AllocateSavingsRequest req)
    {
        if (req.Amount <= 0) return BadRequest("El monto debe ser mayor a 0.");
        if (!MoneyValidation.IsWithinRange(req.Amount))
            return BadRequest($"El monto es demasiado grande. El máximo permitido es {MoneyValidation.MaxAmount:N0}.");

        var wallet = await _db.Wallets.FirstOrDefaultAsync(w => w.UserId == _currentUser.UserId);
        if (wallet is null) return NotFound();
        if (wallet.Balance < req.Amount) return BadRequest("Saldo disponible insuficiente.");

        wallet.Balance -= req.Amount;
        wallet.SavingsFund += req.Amount;
        _db.SavingsMovements.Add(new SavingsMovement { UserId = _currentUser.UserId, Amount = req.Amount, Note = req.Note });

        await _db.SaveChangesAsync();
        return Ok(new WalletDto(wallet.Balance, wallet.SavingsFund));
    }

    [HttpGet("movements")]
    public async Task<ActionResult<List<SavingsMovementDto>>> GetMovements()
    {
        var items = await _db.SavingsMovements
            .Where(s => s.UserId == _currentUser.UserId)
            .OrderByDescending(s => s.Date)
            .ToListAsync();
        return items.Select(s => new SavingsMovementDto(s.Id, s.Amount, s.Date, s.Note)).ToList();
    }

    // US-18: projected total = monthly amount x number of months.
    [HttpGet("projection")]
    public ActionResult<ProjectionResult> Project([FromQuery] decimal monthlyAmount, [FromQuery] int months)
    {
        if (monthlyAmount <= 0 || months <= 0) return BadRequest("Monto y plazo deben ser mayores a 0.");
        if (!MoneyValidation.IsWithinRange(monthlyAmount))
            return BadRequest($"El monto es demasiado grande. El máximo permitido es {MoneyValidation.MaxAmount:N0}.");
        return new ProjectionResult(monthlyAmount, months, monthlyAmount * months);
    }

    // US-19: required monthly quota = target amount / number of months.
    [HttpGet("quota")]
    public ActionResult<QuotaResult> Quota([FromQuery] decimal targetAmount, [FromQuery] int months)
    {
        if (targetAmount <= 0 || months <= 0) return BadRequest("Meta y plazo deben ser mayores a 0.");
        if (!MoneyValidation.IsWithinRange(targetAmount))
            return BadRequest($"El monto es demasiado grande. El máximo permitido es {MoneyValidation.MaxAmount:N0}.");
        var quota = Math.Round(targetAmount / months, 2, MidpointRounding.AwayFromZero);
        return new QuotaResult(targetAmount, months, quota);
    }

    // Backing store for US-24's "planned vs real" comparison chart.
    [HttpPost("plan")]
    public async Task<IActionResult> SetPlan(SetSavingsPlanRequest req)
    {
        if (!MoneyValidation.IsWithinRange(req.PlannedAmount))
            return BadRequest($"El monto debe estar entre 0 y {MoneyValidation.MaxAmount:N0}.");

        var month = new DateOnly(req.Year, req.Month, 1);
        var plan = await _db.SavingsPlans.FirstOrDefaultAsync(p =>
            p.UserId == _currentUser.UserId && p.Month == month);

        if (plan is null)
        {
            plan = new SavingsPlan { UserId = _currentUser.UserId, Month = month, PlannedAmount = req.PlannedAmount };
            _db.SavingsPlans.Add(plan);
        }
        else
        {
            plan.PlannedAmount = req.PlannedAmount;
        }
        await _db.SaveChangesAsync();
        return Ok();
    }
}
