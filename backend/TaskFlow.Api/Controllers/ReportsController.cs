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
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;

    public ReportsController(AppDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // US-24: planned savings (sum of each active goal's required monthly quota)
    // vs what was actually moved into the fund, for the given month.
    [HttpGet("savings-comparison")]
    public async Task<ActionResult<SavingsComparisonDto>> SavingsComparison([FromQuery] int year, [FromQuery] int month)
    {
        var goals = await _db.SavingsGoals
            .Where(g => g.UserId == _currentUser.UserId && g.TargetMonths > 0)
            .ToListAsync();
        var planned = goals.Sum(g => Math.Round(g.TargetAmount / g.TargetMonths, 2, MidpointRounding.AwayFromZero));

        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);
        var real = await _db.SavingsMovements
            .Where(s => s.UserId == _currentUser.UserId && s.Date >= start && s.Date < end)
            .SumAsync(s => s.Amount);

        return new SavingsComparisonDto(planned, real);
    }

    // US-25: expenses broken down by category, for the given month, largest first.
    [HttpGet("expenses-by-category")]
    public async Task<ActionResult<List<ExpenseCategorySlice>>> ExpensesByCategory([FromQuery] int year, [FromQuery] int month)
    {
        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);

        var expenses = await _db.Transactions.Include(t => t.Category)
            .Where(t => t.UserId == _currentUser.UserId && t.Type == TransactionType.Expense
                && t.Date >= start && t.Date < end)
            .ToListAsync();

        var total = expenses.Sum(t => t.Amount);
        var grouped = expenses
            .GroupBy(t => new { Name = t.Category?.Name ?? "Sin categoría", Color = t.Category?.Color ?? "#6B7280" })
            .Select(g => new ExpenseCategorySlice(g.Key.Name, g.Key.Color, g.Sum(t => t.Amount),
                total > 0 ? Math.Round(g.Sum(t => t.Amount) / total * 100, 1) : 0))
            .OrderByDescending(s => s.Amount)
            .ToList();

        return grouped;
    }
}
