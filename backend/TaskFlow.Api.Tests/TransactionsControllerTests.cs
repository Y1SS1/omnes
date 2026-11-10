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

        var list = Assert.IsType<List<TransactionDto>>(result.Value, exactMatch: false);
        Assert.Single(list);
        Assert.Equal(200m, list[0].Amount);
    }

    [Fact]
    public async Task Create_ExpenseLargerThanBalance_IsRejectedAndChangesNothing()
    {
        var (controller, db, userId) = NewController(startingBalance: 320_000m);

        var result = await controller.Create(new CreateTransactionRequest(500_000m, TransactionType.Expense, null, null, null));

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Saldo disponible insuficiente: tienes $320.000.", bad.Value);
        Assert.Equal(320_000m, db.Wallets.Single(w => w.UserId == userId).Balance);
        Assert.Empty(db.Transactions);
    }

    [Fact]
    public async Task Create_ExpenseEqualToBalance_LeavesItAtZero()
    {
        var (controller, db, userId) = NewController(startingBalance: 1000m);

        var result = await controller.Create(new CreateTransactionRequest(1000m, TransactionType.Expense, null, null, null));

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(0m, db.Wallets.Single(w => w.UserId == userId).Balance);
    }

    [Fact]
    public async Task Create_IncomeLargerThanBalance_IsAllowed()
    {
        var (controller, db, userId) = NewController(startingBalance: 0m);

        var result = await controller.Create(new CreateTransactionRequest(5000m, TransactionType.Income, null, null, null));

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(5000m, db.Wallets.Single(w => w.UserId == userId).Balance);
    }

    [Fact]
    public async Task Delete_IncomeAlreadySpent_IsRejectedAndChangesNothing()
    {
        var (controller, db, userId) = NewController(startingBalance: 0m);
        var income = Assert.IsType<TransactionDto>(Assert.IsType<OkObjectResult>(
            (await controller.Create(new CreateTransactionRequest(500m, TransactionType.Income, null, null, null))).Result).Value);
        await controller.Create(new CreateTransactionRequest(400m, TransactionType.Expense, null, null, null));

        var result = await controller.Delete(income.Id);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(100m, db.Wallets.Single(w => w.UserId == userId).Balance);
        Assert.Equal(2, db.Transactions.Count());
    }

    [Fact]
    public async Task Delete_IncomeNotSpent_SubtractsIt()
    {
        var (controller, db, userId) = NewController(startingBalance: 1000m);
        var income = Assert.IsType<TransactionDto>(Assert.IsType<OkObjectResult>(
            (await controller.Create(new CreateTransactionRequest(500m, TransactionType.Income, null, null, null))).Result).Value);

        Assert.IsType<NoContentResult>(await controller.Delete(income.Id));

        Assert.Equal(1000m, db.Wallets.Single(w => w.UserId == userId).Balance);
    }
}
