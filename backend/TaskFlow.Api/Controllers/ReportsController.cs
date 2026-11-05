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

    // The budget the wallet is executing: its split by category and type (from the wallet's
    // editable copy) and, per asset of the source Excel, the estimate vs the AI's price range.
    [HttpGet("planned-budget")]
    public async Task<ActionResult<PlannedBudgetReportDto>> PlannedBudget()
    {
        var userId = _currentUser.UserId;
        var planned = await _db.PlannedItems.Where(i => i.UserId == userId).ToListAsync();
        if (planned.Count == 0)
            return new PlannedBudgetReportDto(null, null, 0, 0, [], []);

        var projectId = planned[0].BudgetProjectId;
        var project = await _db.BudgetProjects
            .Include(p => p.Items)
            .FirstAsync(p => p.Id == projectId && p.UserId == userId);

        var total = planned.Sum(i => i.Amount);
        var byCategory = planned
            .GroupBy(i => i.Category.Trim(), StringComparer.CurrentCultureIgnoreCase)
            .Select(g => new PlannedCategorySlice(g.First().Category.Trim(), g.Sum(i => i.Amount),
                total > 0 ? Math.Round(g.Sum(i => i.Amount) / total * 100, 1) : 0))
            .OrderByDescending(s => s.Amount)
            .ToList();

        var assetQuotes = project.OrderedItems()
            .Where(i => i.Type == BudgetItemType.Asset)
            .Select(i =>
            {
                var range = PriceRangeParser.Parse(BudgetQuoteSummary.Parse(i.AiQuoteSummary)?.PriceRange);
                return new AssetQuoteComparison(i.Name, i.EstimatedAmount, range?.Min, range?.Max);
            })
            .ToList();

        return new PlannedBudgetReportDto(
            project.Id,
            project.Name,
            planned.Where(i => i.Type == BudgetItemType.Asset).Sum(i => i.Amount),
            planned.Where(i => i.Type == BudgetItemType.Liability).Sum(i => i.Amount),
            byCategory,
            assetQuotes);
    }
}
