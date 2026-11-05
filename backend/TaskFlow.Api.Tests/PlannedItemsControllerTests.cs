using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Tests;

public class PlannedItemsControllerTests
{
    private static (PlannedItemsController controller, AppDbContext db, Guid userId) NewController()
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        return (new PlannedItemsController(db, TestHelpers.NewCurrentUser(userId)), db, userId);
    }

    private static BudgetProject AddProject(AppDbContext db, Guid userId, string name = "Pollería")
    {
        var project = new BudgetProject { UserId = userId, Name = name };
        project.Items.Add(new BudgetItem { Name = "Freidora", Category = "Cocina", Type = BudgetItemType.Asset, EstimatedAmount = 650_000m });
        project.Items.Add(new BudgetItem { Name = "Arriendo", Category = "Gastos fijos", Type = BudgetItemType.Liability, EstimatedAmount = 850_000m });
        db.BudgetProjects.Add(project);
        db.SaveChanges();
        return project;
    }

    // Another user's copy, written straight to the database: a second controller would
    // replace the shared HttpContext and silently turn the first one into that user too.
    private static PlannedItem AddForeignItem(AppDbContext db)
    {
        var otherUser = Guid.NewGuid();
        var project = AddProject(db, otherUser, "Ajeno");
        var item = new PlannedItem
        {
            UserId = otherUser, BudgetProjectId = project.Id, Name = "Horno", Category = "Cocina",
            Type = BudgetItemType.Asset, Amount = 1_000m,
        };
        db.PlannedItems.Add(item);
        db.SaveChanges();
        return item;
    }

    private static T Value<T>(ActionResult<T> result) => Assert.IsType<T>(Assert.IsType<OkObjectResult>(result.Result).Value, exactMatch: false);

    private static UpdatePlannedItemRequest ValidUpdate() => new("Freidora grande", "Cocina", BudgetItemType.Asset, 700_000m);

    [Fact]
    public async Task TransferFromProject_CopiesEveryItemWithTheExcelAmount()
    {
        var (controller, db, userId) = NewController();
        var project = AddProject(db, userId);

        var copies = Value(await controller.TransferFromProject(project.Id));

        Assert.Equal(2, copies.Count);
        var fryer = Assert.Single(copies, c => c.Name == "Freidora");
        Assert.Equal(650_000m, fryer.Amount);
        Assert.Equal(BudgetItemType.Asset, fryer.Type);
        Assert.Equal("Cocina", fryer.Category);
        Assert.Equal("Pollería", fryer.BudgetProjectName);
        Assert.Equal(2, db.PlannedItems.Count(i => i.UserId == userId));
    }

    [Fact]
    public async Task TransferFromProject_TwiceReplacesTheEarlierCopy()
    {
        var (controller, db, userId) = NewController();
        var project = AddProject(db, userId);

        await controller.TransferFromProject(project.Id);
        await controller.TransferFromProject(project.Id);

        Assert.Equal(2, db.PlannedItems.Count());
    }

    [Fact]
    public async Task TransferFromProject_ReplacesTheBudgetOfAnotherProject()
    {
        var (controller, db, userId) = NewController();
        var first = AddProject(db, userId, "Primero");
        var second = AddProject(db, userId, "Segundo");

        await controller.TransferFromProject(first.Id);
        await controller.TransferFromProject(second.Id);

        Assert.Equal(2, db.PlannedItems.Count());
        Assert.All(db.PlannedItems, i => Assert.Equal(second.Id, i.BudgetProjectId));
    }

    [Fact]
    public async Task TransferFromProject_KeepsOtherUsersBudgets()
    {
        var (controller, db, userId) = NewController();
        var foreign = AddForeignItem(db);

        await controller.TransferFromProject(AddProject(db, userId).Id);

        Assert.Contains(db.PlannedItems, i => i.Id == foreign.Id);
    }

    [Fact]
    public async Task TransferFromProject_OfAnotherUser_ReturnsNotFound()
    {
        var (controller, db, _) = NewController();
        var project = AddProject(db, Guid.NewGuid());

        var result = await controller.TransferFromProject(project.Id);

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Empty(db.PlannedItems);
    }

    [Fact]
    public async Task List_ReturnsOnlyTheUsersItems()
    {
        var (controller, db, userId) = NewController();
        await controller.TransferFromProject(AddProject(db, userId).Id);
        AddForeignItem(db);

        var items = Value(await controller.List());

        Assert.Equal(2, items.Count);
        Assert.DoesNotContain(items, i => i.Name == "Horno");
    }

    [Fact]
    public async Task Update_ChangesEveryEditableField()
    {
        var (controller, db, userId) = NewController();
        var copies = Value(await controller.TransferFromProject(AddProject(db, userId).Id));
        var fryer = copies.Single(c => c.Name == "Freidora");

        var updated = Value(await controller.Update(fryer.Id, new UpdatePlannedItemRequest(
            "  Freidora grande  ", " Equipos ", BudgetItemType.Liability, 700_000.456m)));

        Assert.Equal("Freidora grande", updated.Name);
        Assert.Equal("Equipos", updated.Category);
        Assert.Equal(BudgetItemType.Liability, updated.Type);
        Assert.Equal(700_000.46m, updated.Amount);
    }

    [Fact]
    public async Task Update_DoesNotChangeTheOriginalProject()
    {
        var (controller, db, userId) = NewController();
        var project = AddProject(db, userId);
        var copies = Value(await controller.TransferFromProject(project.Id));

        await controller.Update(copies.Single(c => c.Name == "Freidora").Id, ValidUpdate());

        Assert.Equal(650_000m, db.BudgetItems.Single(i => i.Name == "Freidora").EstimatedAmount);
    }

    [Theory]
    [InlineData("", "Cocina", 1)]
    [InlineData("Freidora", "  ", 1)]
    [InlineData("Freidora", "Cocina", -1)]
    public async Task Update_WithInvalidData_ReturnsBadRequest(string name, string category, decimal amount)
    {
        var (controller, db, userId) = NewController();
        var copies = Value(await controller.TransferFromProject(AddProject(db, userId).Id));

        var result = await controller.Update(copies[0].Id, new UpdatePlannedItemRequest(name, category, BudgetItemType.Asset, amount));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Update_WithUnknownType_ReturnsBadRequest()
    {
        var (controller, db, userId) = NewController();
        var copies = Value(await controller.TransferFromProject(AddProject(db, userId).Id));

        var result = await controller.Update(copies[0].Id, ValidUpdate() with { Type = (BudgetItemType)5 });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Update_WithTooLongName_ReturnsBadRequest()
    {
        var (controller, db, userId) = NewController();
        var copies = Value(await controller.TransferFromProject(AddProject(db, userId).Id));

        var result = await controller.Update(copies[0].Id, ValidUpdate() with { Name = new string('a', PlannedItemsController.MaxTextLength + 1) });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Update_OfAnotherUser_ReturnsNotFound()
    {
        var (controller, db, _) = NewController();
        var foreign = AddForeignItem(db);

        var result = await controller.Update(foreign.Id, ValidUpdate());

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Equal("Horno", db.PlannedItems.Single(i => i.Id == foreign.Id).Name);
    }

    [Fact]
    public async Task Delete_RemovesTheItem()
    {
        var (controller, db, userId) = NewController();
        var copies = Value(await controller.TransferFromProject(AddProject(db, userId).Id));

        var result = await controller.Delete(copies[0].Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Single(db.PlannedItems);
    }

    [Fact]
    public async Task Delete_OfAnotherUser_ReturnsNotFound()
    {
        var (controller, db, _) = NewController();
        var foreign = AddForeignItem(db);

        var result = await controller.Delete(foreign.Id);

        Assert.IsType<NotFoundResult>(result);
        Assert.Single(db.PlannedItems);
    }
}
