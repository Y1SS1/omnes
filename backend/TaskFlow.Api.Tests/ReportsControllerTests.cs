using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using Xunit;

namespace TaskFlow.Api.Tests;

public class ReportsControllerTests
{
    private static (ReportsController controller, AppDbContext db, Guid userId) NewController()
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        var controller = new ReportsController(db, TestHelpers.NewCurrentUser(userId));
        return (controller, db, userId);
    }

    [Fact]
    public async Task SavingsComparison_SumsPlannedQuotasVsRealMovements()
    {
        var (controller, db, userId) = NewController();
        db.SavingsGoals.Add(new SavingsGoal { UserId = userId, Name = "Viaje", TargetAmount = 1200m, TargetMonths = 12 });
        await db.SaveChangesAsync();
        db.SavingsMovements.Add(new SavingsMovement
        {
            UserId = userId, Amount = 80m, Date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc),
        });
        await db.SaveChangesAsync();

        var result = await controller.SavingsComparison(2026, 10);

        var ok = Assert.IsType<ActionResult<SavingsComparisonDto>>(result);
        var dto = Assert.IsType<SavingsComparisonDto>(ok.Value);
        Assert.Equal(100m, dto.Planned);
        Assert.Equal(80m, dto.Real);
    }

    [Fact]
    public async Task ExpensesByCategory_GroupsExpensesByCategoryLargestFirst()
    {
        var (controller, db, userId) = NewController();
        var food = new Category { UserId = userId, Name = "Comida", Color = "#000", Type = CategoryType.Expense };
        var transport = new Category { UserId = userId, Name = "Transporte", Color = "#fff", Type = CategoryType.Expense };
        db.Categories.AddRange(food, transport);
        await db.SaveChangesAsync();
        db.Transactions.Add(new Transaction
        {
            UserId = userId, Amount = 300m, Type = TransactionType.Expense, CategoryId = food.Id,
            Date = new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc),
        });
        db.Transactions.Add(new Transaction
        {
            UserId = userId, Amount = 100m, Type = TransactionType.Expense, CategoryId = transport.Id,
            Date = new DateTime(2026, 10, 6, 0, 0, 0, DateTimeKind.Utc),
        });
        db.Transactions.Add(new Transaction
        {
            UserId = userId, Amount = 1000m, Type = TransactionType.Income,
            Date = new DateTime(2026, 10, 7, 0, 0, 0, DateTimeKind.Utc),
        });
        await db.SaveChangesAsync();

        var result = await controller.ExpensesByCategory(2026, 10);

        var list = Assert.IsType<List<ExpenseCategorySlice>>(result.Value, exactMatch: false);
        Assert.Equal(2, list.Count);
        Assert.Equal("Comida", list[0].CategoryName);
        Assert.Equal(300m, list[0].Amount);
        Assert.Equal(75m, list[0].Percent);
    }
}
