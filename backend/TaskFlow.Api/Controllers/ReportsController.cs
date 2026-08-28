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

    // US-21: days completed (green check) vs days scheduled, per habit, for the given month.
    [HttpGet("habit-completion")]
    public async Task<ActionResult<List<HabitCompletionReportItem>>> HabitCompletion([FromQuery] int year, [FromQuery] int month)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var effectiveEnd = end < today.AddDays(1) ? end : today.AddDays(1);

        var habits = await _db.Tasks
            .Where(t => t.UserId == _currentUser.UserId && t.IsRepetitive && t.CreatedAt < DateTime.SpecifyKind(end.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc))
            .ToListAsync();

        var habitIds = habits.Select(h => h.Id).ToList();
        var completions = await _db.HabitCompletions
            .Where(h => habitIds.Contains(h.TaskItemId) && h.Date >= start && h.Date < end && h.IsChecked)
            .ToListAsync();

        var result = new List<HabitCompletionReportItem>();
        foreach (var habit in habits)
        {
            var createdDate = DateOnly.FromDateTime(habit.CreatedAt);
            var rangeStart = createdDate > start ? createdDate : start;
            int scheduled = 0;
            for (var d = rangeStart; d < effectiveEnd; d = d.AddDays(1))
            {
                if (DaysOfWeekHelper.IsScheduledOn(habit.RepeatDays, d)) scheduled++;
            }
            var completed = completions.Count(c => c.TaskItemId == habit.Id);
            var pct = scheduled > 0 ? Math.Round((decimal)completed / scheduled * 100, 1) : 0;
            result.Add(new HabitCompletionReportItem(habit.Title, scheduled, completed, pct));
        }

        return result;
    }

    // US-22: count of tasks/habits/activities checked as done, per day, for the given range.
    [HttpGet("productivity-timeline")]
    public async Task<ActionResult<List<ProductivityPoint>>> ProductivityTimeline([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        var points = new Dictionary<DateOnly, int>();
        for (var d = from; d <= to; d = d.AddDays(1)) points[d] = 0;

        var completedTasks = await _db.Tasks
            .Where(t => t.UserId == _currentUser.UserId && !t.IsRepetitive && t.IsCompleted && t.CompletedAt != null)
            .Select(t => t.CompletedAt!.Value)
            .ToListAsync();
        foreach (var c in completedTasks)
        {
            var d = DateOnly.FromDateTime(c);
            if (points.ContainsKey(d)) points[d]++;
        }

        var habitIds = await _db.Tasks
            .Where(t => t.UserId == _currentUser.UserId && t.IsRepetitive)
            .Select(t => t.Id).ToListAsync();
        var habitChecks = await _db.HabitCompletions
            .Where(h => habitIds.Contains(h.TaskItemId) && h.IsChecked && h.Date >= from && h.Date <= to)
            .Select(h => h.Date).ToListAsync();
        foreach (var d in habitChecks)
        {
            if (points.ContainsKey(d)) points[d]++;
        }

        return points.OrderBy(p => p.Key).Select(p => new ProductivityPoint(p.Key, p.Value)).ToList();
    }

    // US-23: completed tasks grouped by their category's color.
    [HttpGet("task-categories")]
    public async Task<ActionResult<List<TaskCategorySlice>>> TaskCategories([FromQuery] int year, [FromQuery] int month)
    {
        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);

        var completed = await _db.Tasks.Include(t => t.Category)
            .Where(t => t.UserId == _currentUser.UserId && t.IsCompleted
                && t.CompletedAt != null && t.CompletedAt >= start && t.CompletedAt < end)
            .ToListAsync();

        var total = completed.Count;
        var grouped = completed
            .GroupBy(t => new { Name = t.Category?.Name ?? "Sin categoría", Color = t.Category?.Color ?? "#6B7280" })
            .Select(g => new TaskCategorySlice(g.Key.Name, g.Key.Color, g.Count(),
                total > 0 ? Math.Round((decimal)g.Count() / total * 100, 1) : 0))
            .OrderByDescending(s => s.Count)
            .ToList();

        return grouped;
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
