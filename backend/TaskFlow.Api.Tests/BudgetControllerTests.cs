using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using Xunit;

namespace TaskFlow.Api.Tests;

public class BudgetControllerTests
{
    private static (BudgetController controller, AppDbContext db, Guid userId) NewController()
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        var controller = new BudgetController(db, TestHelpers.NewCurrentUser(userId));
        return (controller, db, userId);
    }

    [Fact]
    public async Task Set_WithNewMonth_CreatesBudget()
    {
        var (controller, db, userId) = NewController();

        var result = await controller.Set(new SetBudgetRequest(2026, 10, 100_000m));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<BudgetProgressDto>(ok.Value);
        Assert.Equal(100_000m, dto.LimitAmount);
        Assert.Single(db.Budgets.Where(b => b.UserId == userId));
    }

    [Fact]
    public async Task Set_CalledTwiceForSameMonth_UpdatesInPlace()
    {
        var (controller, db, userId) = NewController();
        await controller.Set(new SetBudgetRequest(2026, 10, 100_000m));

        await controller.Set(new SetBudgetRequest(2026, 10, 150_000m));

        var budget = Assert.Single(db.Budgets.Where(b => b.UserId == userId));
        Assert.Equal(150_000m, budget.LimitAmount);
    }

    [Fact]
    public async Task Set_WithNegativeAmount_ReturnsBadRequest()
    {
        var (controller, _, _) = NewController();

        var result = await controller.Set(new SetBudgetRequest(2026, 10, -1m));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Theory]
    [InlineData(500, "green")]   // 50% used
    [InlineData(800, "yellow")]  // 80% used
    [InlineData(950, "red")]     // 95% used
    public async Task Get_ColorReflectsPercentUsed(decimal spent, string expectedColor)
    {
        var (controller, db, userId) = NewController();
        db.Budgets.Add(new Budget { UserId = userId, Month = new DateOnly(2026, 10, 1), LimitAmount = 1000m });
        db.Transactions.Add(new Transaction
        {
            UserId = userId, Amount = spent, Type = TransactionType.Expense,
            Date = new DateTime(2026, 10, 15, 0, 0, 0, DateTimeKind.Utc),
        });
        await db.SaveChangesAsync();

        var result = await controller.Get(2026, 10);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<BudgetProgressDto>(ok.Value);
        Assert.Equal(expectedColor, dto.Color);
    }

    [Fact]
    public async Task Get_WithoutBudgetSet_ReturnsZeroLimitAndGreen()
    {
        var (controller, _, _) = NewController();

        var result = await controller.Get(2026, 10);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<BudgetProgressDto>(ok.Value);
        Assert.Equal(0m, dto.LimitAmount);
        Assert.Equal("green", dto.Color);
    }

    [Fact]
    public async Task Get_OnlyCountsTransactionsWithinTheRequestedMonth()
    {
        var (controller, db, userId) = NewController();
        db.Budgets.Add(new Budget { UserId = userId, Month = new DateOnly(2026, 10, 1), LimitAmount = 1000m });
        db.Transactions.Add(new Transaction
        {
            UserId = userId, Amount = 500m, Type = TransactionType.Expense,
            Date = new DateTime(2026, 9, 30, 23, 0, 0, DateTimeKind.Utc), // previous month
        });
        await db.SaveChangesAsync();

        var result = await controller.Get(2026, 10);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<BudgetProgressDto>(ok.Value);
        Assert.Equal(0m, dto.Spent);
    }
}
