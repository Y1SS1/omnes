using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using Xunit;

namespace TaskFlow.Api.Tests;

public class SavingsControllerTests
{
    private static (SavingsController controller, AppDbContext db, Guid userId) NewController(decimal walletBalance = 1000m)
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        db.Wallets.Add(new Wallet { UserId = userId, Balance = walletBalance, SavingsFund = 0m });
        db.SaveChanges();
        var controller = new SavingsController(db, TestHelpers.NewCurrentUser(userId));
        return (controller, db, userId);
    }

    [Fact]
    public async Task CreateGoal_ComputesMonthlyQuota()
    {
        var (controller, _, _) = NewController();

        var result = await controller.CreateGoal(new CreateSavingsGoalRequest("Viaje", 1200m, 12));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<SavingsGoalDto>(ok.Value);
        Assert.Equal(100m, dto.MonthlyQuota);
    }

    [Fact]
    public async Task CreateGoal_WithoutName_ReturnsBadRequest()
    {
        var (controller, _, _) = NewController();

        var result = await controller.CreateGoal(new CreateSavingsGoalRequest("", 1200m, 12));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Allocate_MovesMoneyFromBalanceToSavingsFund()
    {
        var (controller, db, userId) = NewController(walletBalance: 1000m);

        var result = await controller.Allocate(new AllocateSavingsRequest(300m, "Ahorro mensual", null));

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<WalletDto>(ok.Value);
        Assert.Equal(700m, dto.Balance);
        Assert.Equal(300m, dto.SavingsFund);
        Assert.Single(db.SavingsMovements.Where(m => m.UserId == userId));
    }

    [Fact]
    public async Task Allocate_MoreThanAvailableBalance_ReturnsBadRequest()
    {
        var (controller, _, _) = NewController(walletBalance: 100m);

        var result = await controller.Allocate(new AllocateSavingsRequest(300m, null, null));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Allocate_WithUnknownGoal_ReturnsBadRequest()
    {
        var (controller, _, _) = NewController(walletBalance: 1000m);

        var result = await controller.Allocate(new AllocateSavingsRequest(100m, null, Guid.NewGuid()));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task GetGoals_IncludesTotalSavedFromMovements()
    {
        var (controller, db, userId) = NewController();
        var goal = new SavingsGoal { UserId = userId, Name = "Viaje", TargetAmount = 1000m, TargetMonths = 10 };
        db.SavingsGoals.Add(goal);
        db.SavingsMovements.Add(new SavingsMovement { UserId = userId, Amount = 150m, SavingsGoalId = goal.Id });
        db.SavingsMovements.Add(new SavingsMovement { UserId = userId, Amount = 50m, SavingsGoalId = goal.Id });
        await db.SaveChangesAsync();

        var result = await controller.GetGoals();

        var list = Assert.IsAssignableFrom<List<SavingsGoalDto>>(result.Value);
        var dto = Assert.Single(list);
        Assert.Equal(200m, dto.SavedAmount);
    }

    [Fact]
    public async Task GetMovements_FiltersByGoalId()
    {
        var (controller, db, userId) = NewController();
        var goal = new SavingsGoal { UserId = userId, Name = "Viaje", TargetAmount = 1000m, TargetMonths = 10 };
        db.SavingsGoals.Add(goal);
        db.SavingsMovements.Add(new SavingsMovement { UserId = userId, Amount = 100m, SavingsGoalId = goal.Id });
        db.SavingsMovements.Add(new SavingsMovement { UserId = userId, Amount = 50m, SavingsGoalId = null });
        await db.SaveChangesAsync();

        var result = await controller.GetMovements(goal.Id);

        var list = Assert.IsAssignableFrom<List<SavingsMovementDto>>(result.Value);
        Assert.Single(list);
        Assert.Equal(100m, list[0].Amount);
    }
}
