using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using Xunit;

namespace TaskFlow.Api.Tests;

public class TransactionsControllerTests
{
    private static (TransactionsController controller, AppDbContext db, Guid userId) NewController(decimal startingBalance = 1000m)
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        db.Wallets.Add(new Wallet { UserId = userId, Balance = startingBalance, SavingsFund = 0m });
        db.SaveChanges();
        var controller = new TransactionsController(db, TestHelpers.NewCurrentUser(userId));
        return (controller, db, userId);
    }

    [Fact]
    public async Task Create_Expense_SubtractsFromWalletBalance()
    {
        var (controller, db, userId) = NewController(startingBalance: 1000m);

        await controller.Create(new CreateTransactionRequest(300m, TransactionType.Expense, null, "Compras", null));

        Assert.Equal(700m, db.Wallets.Single(w => w.UserId == userId).Balance);
    }

    [Fact]
    public async Task Create_Income_AddsToWalletBalance()
    {
        var (controller, db, userId) = NewController(startingBalance: 1000m);

        await controller.Create(new CreateTransactionRequest(300m, TransactionType.Income, null, "Sueldo", null));

        Assert.Equal(1300m, db.Wallets.Single(w => w.UserId == userId).Balance);
    }

    [Fact]
    public async Task Create_WithZeroAmount_ReturnsBadRequest()
    {
        var (controller, _, _) = NewController();

        var result = await controller.Create(new CreateTransactionRequest(0m, TransactionType.Expense, null, null, null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_WithoutWallet_ReturnsNotFound()
    {
        var db = TestHelpers.NewDbContext();
        var controller = new TransactionsController(db, TestHelpers.NewCurrentUser(Guid.NewGuid()));

        var result = await controller.Create(new CreateTransactionRequest(100m, TransactionType.Expense, null, null, null));

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_ExpenseCrossing90PercentOfBudget_RaisesNotification()
    {
        var (controller, db, userId) = NewController(startingBalance: 10_000m);
        db.Budgets.Add(new Budget { UserId = userId, Month = new DateOnly(2026, 10, 1), LimitAmount = 1000m });
        await db.SaveChangesAsync();

        // 85% already spent, this expense pushes it past 90%
        await controller.Create(new CreateTransactionRequest(
            850m, TransactionType.Expense, null, null, new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc)));
        await controller.Create(new CreateTransactionRequest(
            100m, TransactionType.Expense, null, null, new DateTime(2026, 10, 2, 0, 0, 0, DateTimeKind.Utc)));

        Assert.Single(db.Notifications.Where(n => n.UserId == userId));
    }

    [Fact]
    public async Task Create_ExpenseStayingUnder90Percent_DoesNotRaiseNotification()
    {
        var (controller, db, userId) = NewController(startingBalance: 10_000m);
        db.Budgets.Add(new Budget { UserId = userId, Month = new DateOnly(2026, 10, 1), LimitAmount = 1000m });
        await db.SaveChangesAsync();

        await controller.Create(new CreateTransactionRequest(
            500m, TransactionType.Expense, null, null, new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc)));

        Assert.Empty(db.Notifications.Where(n => n.UserId == userId));
    }

    [Fact]
    public async Task Delete_Expense_RefundsWalletBalance()
    {
        var (controller, db, userId) = NewController(startingBalance: 1000m);
        var created = await controller.Create(new CreateTransactionRequest(300m, TransactionType.Expense, null, null, null));
        var dto = Assert.IsType<TransactionDto>(Assert.IsType<OkObjectResult>(created.Result).Value);

        await controller.Delete(dto.Id);

        Assert.Equal(1000m, db.Wallets.Single(w => w.UserId == userId).Balance);
        Assert.Empty(db.Transactions.Where(t => t.UserId == userId));
    }

    [Fact]
    public async Task GetAll_FiltersByYearAndMonth()
    {
        var (controller, db, userId) = NewController();
        db.Transactions.Add(new Transaction
        {
            UserId = userId, Amount = 100m, Type = TransactionType.Expense,
            Date = new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc),
        });
        db.Transactions.Add(new Transaction
        {
            UserId = userId, Amount = 200m, Type = TransactionType.Expense,
            Date = new DateTime(2026, 10, 15, 0, 0, 0, DateTimeKind.Utc),
        });
        await db.SaveChangesAsync();

        var result = await controller.GetAll(2026, 10);

        var list = Assert.IsAssignableFrom<List<TransactionDto>>(result.Value);
        Assert.Single(list);
        Assert.Equal(200m, list[0].Amount);
    }
}
