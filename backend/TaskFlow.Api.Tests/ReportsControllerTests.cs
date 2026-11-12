using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;
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

    private static BudgetProject AddPlannedBudget(AppDbContext db, Guid userId)
    {
        var project = new BudgetProject { UserId = userId, Name = "Pollería" };
        project.Items.Add(new BudgetItem
        {
            Name = "Freidora", Category = "Cocina", Type = BudgetItemType.Asset, EstimatedAmount = 650_000m,
            AiQuoteSummary = BudgetQuoteSummary.Format("$400.000 - $600.000 CLP", "Gastromaq", "Sodimac", []),
        });
        project.Items.Add(new BudgetItem { Name = "Mesón", Category = "Mobiliario", Type = BudgetItemType.Asset, EstimatedAmount = 280_000m });
        project.Items.Add(new BudgetItem { Name = "Arriendo", Category = "Gastos fijos", Type = BudgetItemType.Liability, EstimatedAmount = 850_000m });
        db.BudgetProjects.Add(project);
        // The wallet copy, already edited by the user: the category spelling and the amounts differ.
        db.PlannedItems.AddRange(
            new PlannedItem { UserId = userId, BudgetProjectId = project.Id, Name = "Freidora", Category = "Cocina", Type = BudgetItemType.Asset, Amount = 700_000m },
            new PlannedItem { UserId = userId, BudgetProjectId = project.Id, Name = "Mesón", Category = "cocina ", Type = BudgetItemType.Asset, Amount = 300_000m },
            new PlannedItem { UserId = userId, BudgetProjectId = project.Id, Name = "Arriendo", Category = "Gastos fijos", Type = BudgetItemType.Liability, Amount = 1_000_000m });
        db.SaveChanges();
        return project;
    }

    [Fact]
    public async Task PlannedBudget_WithoutABudgetInTheWallet_ReturnsAnEmptyReport()
    {
        var (controller, _, _) = NewController();

        var dto = (await controller.PlannedBudget()).Value!;

        Assert.Null(dto.ProjectId);
        Assert.Empty(dto.ByCategory);
        Assert.Empty(dto.AssetQuotes);
    }

    [Fact]
    public async Task PlannedBudget_TotalsTheWalletCopyByTypeAndCategory()
    {
        var (controller, db, userId) = NewController();
        var project = AddPlannedBudget(db, userId);

        var dto = (await controller.PlannedBudget()).Value!;

        Assert.Equal(project.Id, dto.ProjectId);
        Assert.Equal("Pollería", dto.ProjectName);
        Assert.Equal(1_000_000m, dto.AssetsTotal);
        Assert.Equal(1_000_000m, dto.LiabilitiesTotal);
        Assert.Equal(2, dto.ByCategory.Count);
        Assert.All(dto.ByCategory, slice => Assert.Equal(50m, slice.Percent));
        Assert.Contains(dto.ByCategory, slice => slice.Category == "Cocina" && slice.Amount == 1_000_000m);
    }

    [Fact]
    public async Task PlannedBudget_ComparesEachAssetEstimateWithTheAiRange()
    {
        var (controller, db, userId) = NewController();
        AddPlannedBudget(db, userId);

        var dto = (await controller.PlannedBudget()).Value!;

        Assert.Equal(2, dto.AssetQuotes.Count);
        var fryer = Assert.Single(dto.AssetQuotes, a => a.Name == "Freidora");
        Assert.Equal(650_000m, fryer.EstimatedAmount);
        Assert.Equal(400_000m, fryer.PriceMin);
        Assert.Equal(600_000m, fryer.PriceMax);
        var counter = Assert.Single(dto.AssetQuotes, a => a.Name == "Mesón");
        Assert.Null(counter.PriceMin);
    }

    [Fact]
    public async Task PlannedBudget_IgnoresOtherUsersBudgets()
    {
        var (controller, db, _) = NewController();
        AddPlannedBudget(db, Guid.NewGuid());

        var dto = (await controller.PlannedBudget()).Value!;

        Assert.Null(dto.ProjectId);
    }

    [Fact]
    public async Task PlannedBudget_ForABudgetOutsideTheWallet_UsesItsOwnItems()
    {
        var (controller, db, userId) = NewController();
        AddPlannedBudget(db, userId);
        var other = new BudgetProject { UserId = userId, Name = "Cafetería" };
        other.Items.Add(new BudgetItem { Name = "Cafetera", Category = "Equipos", Type = BudgetItemType.Asset, EstimatedAmount = 300_000m });
        other.Items.Add(new BudgetItem { Name = "Luz", Category = "Servicios", Type = BudgetItemType.Liability, EstimatedAmount = 100_000m });
        db.BudgetProjects.Add(other);
        db.SaveChanges();

        var dto = (await controller.PlannedBudget(other.Id)).Value!;

        Assert.Equal(other.Id, dto.ProjectId);
        Assert.False(dto.InWallet);
        Assert.Equal(300_000m, dto.AssetsTotal);
        Assert.Equal(100_000m, dto.LiabilitiesTotal);
        Assert.Equal("Cafetera", Assert.Single(dto.AssetQuotes).Name);
    }

    [Fact]
    public async Task PlannedBudget_ByDefault_IsTheWalletBudget()
    {
        var (controller, db, userId) = NewController();
        var project = AddPlannedBudget(db, userId);

        var dto = (await controller.PlannedBudget()).Value!;

        Assert.Equal(project.Id, dto.ProjectId);
        Assert.True(dto.InWallet);
    }

    [Fact]
    public async Task PlannedBudget_OfAnotherUsersBudget_ReturnsNotFound()
    {
        var (controller, db, _) = NewController();
        var foreign = AddPlannedBudget(db, Guid.NewGuid());

        var result = await controller.PlannedBudget(foreign.Id);

        Assert.IsType<NotFoundResult>(result.Result);
    }
}
