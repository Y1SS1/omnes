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

    // Analyses one budget: by default the one the wallet executes, or any of the user's budgets
    // when projectId is given. Its split by category and type comes from the wallet's edited
    // copy when the budget is in the wallet, else from its own items; per asset, the estimate
    // is compared with the AI's price range.
    [HttpGet("planned-budget")]
    public async Task<ActionResult<PlannedBudgetReportDto>> PlannedBudget([FromQuery] Guid? projectId = null)
    {
        var userId = _currentUser.UserId;
        var planned = await _db.PlannedItems.Where(i => i.UserId == userId).ToListAsync();
        var walletProjectId = planned.FirstOrDefault()?.BudgetProjectId;
        var targetId = projectId ?? walletProjectId;
        if (targetId is null)
            return new PlannedBudgetReportDto(null, null, false, 0, 0, [], []);

        var project = await _db.BudgetProjects
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == targetId && p.UserId == userId);
        if (project is null) return NotFound();

        var inWallet = project.Id == walletProjectId;
        var lines = inWallet
            ? planned.Select(i => (i.Category, i.Type, i.Amount)).ToList()
            : project.Items.Select(i => (i.Category, i.Type, Amount: i.EstimatedAmount)).ToList();

        var total = lines.Sum(i => i.Amount);
        var byCategory = lines
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
            inWallet,
            lines.Where(i => i.Type == BudgetItemType.Asset).Sum(i => i.Amount),
            lines.Where(i => i.Type == BudgetItemType.Liability).Sum(i => i.Amount),
            byCategory,
            assetQuotes);
    }
}
