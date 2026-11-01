using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using Xunit;

namespace TaskFlow.Api.Tests;

public class WalletControllerTests
{
    private static (WalletController controller, AppDbContext db, Guid userId) NewController()
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        db.Wallets.Add(new Wallet { UserId = userId, Balance = 1000m, SavingsFund = 0m });
        db.SaveChanges();
        var controller = new WalletController(db, TestHelpers.NewCurrentUser(userId));
        return (controller, db, userId);
    }

    [Fact]
    public async Task Get_ReturnsTheCurrentUsersWallet()
    {
        var (controller, _, _) = NewController();

        var result = await controller.Get();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<WalletDto>(ok.Value);
        Assert.Equal(1000m, dto.Balance);
    }

    [Fact]
    public async Task Get_WithNoWalletForUser_ReturnsNotFound()
    {
        var db = TestHelpers.NewDbContext();
        var controller = new WalletController(db, TestHelpers.NewCurrentUser(Guid.NewGuid()));

        var result = await controller.Get();

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task SetBalance_WithValidAmount_UpdatesBalance()
    {
        var (controller, db, userId) = NewController();

        var result = await controller.SetBalance(new SetBalanceRequest(5000m));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<WalletDto>(ok.Value);
        Assert.Equal(5000m, dto.Balance);
        Assert.Equal(5000m, db.Wallets.Single(w => w.UserId == userId).Balance);
    }

    [Fact]
    public async Task SetBalance_WithNegativeAmount_ReturnsBadRequest()
    {
        var (controller, _, _) = NewController();

        var result = await controller.SetBalance(new SetBalanceRequest(-1m));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task SetBalance_AboveMaxAmount_ReturnsBadRequest()
    {
        var (controller, _, _) = NewController();

        var result = await controller.SetBalance(new SetBalanceRequest(1_000_000_000_000m));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
