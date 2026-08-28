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
[Route("api/budget")]
public class BudgetController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;

    public BudgetController(AppDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // US-14: define the monthly spending limit.
    [HttpPost]
    public async Task<ActionResult<BudgetProgressDto>> Set(SetBudgetRequest req)
    {
        if (!MoneyValidation.IsWithinRange(req.LimitAmount))
            return BadRequest($"El monto debe estar entre 0 y {MoneyValidation.MaxAmount:N0}.");

        var month = new DateOnly(req.Year, req.Month, 1);
        var budget = await _db.Budgets.FirstOrDefaultAsync(b =>
            b.UserId == _currentUser.UserId && b.Month == month);

        if (budget is null)
        {
            budget = new Budget { UserId = _currentUser.UserId, Month = month, LimitAmount = req.LimitAmount };
            _db.Budgets.Add(budget);
        }
        else
        {
            budget.LimitAmount = req.LimitAmount;
        }
        await _db.SaveChangesAsync();

        return Ok(await GetProgress(req.Year, req.Month));
    }

    // US-15: progress bar (spent vs limit) that changes color as it fills up.
    [HttpGet]
    public async Task<ActionResult<BudgetProgressDto>> Get([FromQuery] int year, [FromQuery] int month)
    {
        return Ok(await GetProgress(year, month));
    }

    private async Task<BudgetProgressDto> GetProgress(int year, int month)
    {
        var monthDate = new DateOnly(year, month, 1);
        var budget = await _db.Budgets.FirstOrDefaultAsync(b =>
            b.UserId == _currentUser.UserId && b.Month == monthDate);

        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);
        var spent = await _db.Transactions
            .Where(t => t.UserId == _currentUser.UserId && t.Type == TransactionType.Expense
                && t.Date >= start && t.Date < end)
            .SumAsync(t => t.Amount);

        var limit = budget?.LimitAmount ?? 0;
        var pct = limit > 0 ? Math.Round(spent / limit * 100, 1) : 0;
        var color = pct < 60 ? "green" : pct < 90 ? "yellow" : "red";

        return new BudgetProgressDto(year, month, limit, spent, pct, color);
    }
}
