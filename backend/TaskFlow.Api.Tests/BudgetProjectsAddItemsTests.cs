using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Tests;

// POST /api/budget-projects/{id}/items: adding the "¿Qué me falta?" suggestions the user picked.
public class BudgetProjectsAddItemsTests
{
    // Adding items never calls the AI.
    private sealed class NoAi : IBudgetItemClassifier, IBudgetItemQuoter
    {
        public Task<IReadOnlyList<BudgetItemType>> ClassifyAsync(
            IReadOnlyList<BudgetItemToClassify> items, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("No debería llamar a la IA.");

        public Task<string> QuoteAsync(string name, string category, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("No debería llamar a la IA.");
    }

    private static (BudgetProjectsController controller, AppDbContext db, Guid userId) NewController()
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        var noAi = new NoAi();
        return (new BudgetProjectsController(db, TestHelpers.NewCurrentUser(userId), noAi, noAi), db, userId);
    }

    private static async Task<BudgetProject> SeedProject(AppDbContext db, Guid userId, int itemCount = 1)
    {
        var project = new BudgetProject { UserId = userId, Name = "Mi pollería" };
        for (var i = 1; i <= itemCount; i++)
            project.Items.Add(new BudgetItem { Name = $"Ítem {i}", Category = "Cocina", Type = BudgetItemType.Asset, EstimatedAmount = 1000m });
        db.BudgetProjects.Add(project);
        await db.SaveChangesAsync();
        return project;
    }

    private static AddBudgetItemsRequest Request(params CreateBudgetItemRequest[] items) => new(items.ToList());

    private static CreateBudgetItemRequest Extintor => new(" Extintor PQS 6 kg ", "Seguridad", BudgetItemType.Asset, 35_000.4m);

    private static CreateBudgetItemRequest Patente => new("Patente municipal", "Permisos", BudgetItemType.Liability, 120_000m);

    [Fact]
    public async Task AddItems_AddsThemUnquotedToTheBudget()
    {
        var (controller, db, userId) = NewController();
        var project = await SeedProject(db, userId);

        var result = await controller.AddItems(project.Id, Request(Extintor, Patente));

        var dto = Assert.IsType<BudgetProjectDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(3, dto.Items.Count);
        var extintor = dto.Items.Single(i => i.Name == "Extintor PQS 6 kg");
        Assert.Equal(35_000.4m, extintor.EstimatedAmount);
        Assert.Null(extintor.AiQuoteSummary);
        Assert.Equal(3, db.BudgetItems.Count(i => i.BudgetProjectId == project.Id));
        Assert.Empty(db.PlannedItems);
    }

    [Fact]
    public async Task AddItems_ToTheBudgetInTheWallet_AlsoAddsThemToTheWallet()
    {
        var (controller, db, userId) = NewController();
        var project = await SeedProject(db, userId);
        db.PlannedItems.Add(new PlannedItem
        {
            UserId = userId, BudgetProjectId = project.Id, Name = "Ítem 1", Category = "Cocina", Type = BudgetItemType.Asset, Amount = 900m,
        });
        await db.SaveChangesAsync();

        await controller.AddItems(project.Id, Request(Extintor, Patente));

        var wallet = db.PlannedItems.Where(i => i.BudgetProjectId == project.Id).ToList();
        Assert.Equal(3, wallet.Count);
        // The wallet's own edits are kept.
        Assert.Equal(900m, wallet.Single(i => i.Name == "Ítem 1").Amount);
        var patente = wallet.Single(i => i.Name == "Patente municipal");
        Assert.Equal(BudgetItemType.Liability, patente.Type);
        Assert.Equal(120_000m, patente.Amount);
        Assert.All(wallet, i => Assert.Equal(userId, i.UserId));
    }

    [Fact]
    public async Task AddItems_AnotherUsersBudget_IsNotFound()
    {
        var (controller, db, _) = NewController();
        var project = await SeedProject(db, Guid.NewGuid());

        var result = await controller.AddItems(project.Id, Request(Extintor));

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Equal(1, db.BudgetItems.Count());
    }

    [Fact]
    public async Task AddItems_WithNothingChosen_IsRejected()
    {
        var (controller, db, userId) = NewController();
        var project = await SeedProject(db, userId);

        Assert.IsType<BadRequestObjectResult>((await controller.AddItems(project.Id, Request())).Result);
        Assert.IsType<BadRequestObjectResult>((await controller.AddItems(project.Id, new AddBudgetItemsRequest(null))).Result);
    }

    [Fact]
    public async Task AddItems_PastTheItemLimit_IsRejectedAndAddsNothing()
    {
        var (controller, db, userId) = NewController();
        var project = await SeedProject(db, userId, BudgetExcelReader.MaxItems - 1);

        var result = await controller.AddItems(project.Id, Request(Extintor, Patente));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(BudgetExcelReader.MaxItems - 1, db.BudgetItems.Count());
    }

    [Fact]
    public async Task AddItems_WithAnInvalidItem_IsRejectedAndAddsNothing()
    {
        var (controller, db, userId) = NewController();
        var project = await SeedProject(db, userId);

        var result = await controller.AddItems(
            project.Id, Request(Extintor, new CreateBudgetItemRequest("Mesa", "Mobiliario", BudgetItemType.Asset, -1m)));

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.StartsWith("Ítem 2", (string)bad.Value!);
        Assert.Equal(1, db.BudgetItems.Count());
    }
}
