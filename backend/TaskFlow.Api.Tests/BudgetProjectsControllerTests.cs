using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;
using Xunit;

namespace TaskFlow.Api.Tests;

public class BudgetProjectsControllerTests
{
    private sealed class FakeClassifier : IBudgetItemClassifier
    {
        public bool Fail { get; init; }
        public int Calls { get; private set; }
        public IReadOnlyList<BudgetItemToClassify> Received { get; private set; } = [];

        public Task<IReadOnlyList<BudgetItemType>> ClassifyAsync(
            IReadOnlyList<BudgetItemToClassify> items, CancellationToken cancellationToken = default)
        {
            Calls++;
            Received = items;
            if (Fail) throw new BudgetClassificationException("La IA falló.");
            IReadOnlyList<BudgetItemType> types = items
                .Select(i => i.Category == "Arriendo" ? BudgetItemType.Liability : BudgetItemType.Asset)
                .ToList();
            return Task.FromResult(types);
        }
    }

    private sealed class FakeQuoter : IBudgetItemQuoter
    {
        public bool Fail { get; set; }
        public int Calls { get; private set; }

        public Task<string> QuoteAsync(string name, string category, CancellationToken cancellationToken = default)
        {
            Calls++;
            if (Fail) throw new BudgetQuoteException("La IA falló.");
            return Task.FromResult($"Rango: $1 - $2 CLP. Proveedores sugeridos: Tienda de {name}.");
        }
    }

    private static (BudgetProjectsController controller, AppDbContext db, Guid userId, FakeClassifier classifier) NewController(
        bool classifierFails = false)
    {
        var (controller, db, userId, classifier, _) = NewControllerWithQuoter(classifierFails);
        return (controller, db, userId, classifier);
    }

    private static (BudgetProjectsController controller, AppDbContext db, Guid userId, FakeClassifier classifier, FakeQuoter quoter) NewControllerWithQuoter(
        bool classifierFails = false)
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        var classifier = new FakeClassifier { Fail = classifierFails };
        var quoter = new FakeQuoter();
        return (new BudgetProjectsController(db, TestHelpers.NewCurrentUser(userId), classifier, quoter), db, userId, classifier, quoter);
    }

    private static FormFile ValidFile(string fileName = "presupuesto.xlsx")
    {
        var stream = TestHelpers.NewBudgetExcel(
            ["Nombre", "Categoría", "Monto estimado"],
            ["Carne", "Insumos", 150000],
            ["Arriendo local", "Arriendo", 800000]);
        return new FormFile(stream, 0, stream.Length, "file", fileName);
    }

    private static async Task<BudgetProject> SeedProject(AppDbContext db, Guid userId)
    {
        var project = new BudgetProject
        {
            UserId = userId,
            Name = "Mi cafetería",
            Items = { new BudgetItem { Name = "Carne", Type = BudgetItemType.Asset, Category = "Insumos", EstimatedAmount = 1000m } },
        };
        db.BudgetProjects.Add(project);
        await db.SaveChangesAsync();
        return project;
    }

    [Fact]
    public async Task Import_ValidFile_SavesProjectWithClassifiedItems()
    {
        var (controller, db, userId, classifier) = NewController();

        var result = await controller.Import("  Mi cafetería ", ValidFile(), default);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<BudgetProjectDto>(ok.Value);
        Assert.Equal("Mi cafetería", dto.Name);
        Assert.Equal(BudgetItemType.Liability, dto.Items.Single(i => i.Name == "Arriendo local").Type);
        Assert.Equal(BudgetItemType.Asset, dto.Items.Single(i => i.Name == "Carne").Type);
        Assert.Equal(150000m, dto.Items.Single(i => i.Name == "Carne").EstimatedAmount);
        Assert.All(dto.Items, i => Assert.Null(i.AiQuoteSummary));
        Assert.All(dto.Items, i => Assert.Null(i.AiQuotedAt));

        Assert.Equal(userId, Assert.Single(db.BudgetProjects).UserId);
        Assert.Equal(2, db.BudgetItems.Count());
        Assert.Equal("Carne", classifier.Received[0].Name);
    }

    [Fact]
    public async Task Import_WhenClassifierFails_Returns503AndSavesNothing()
    {
        var (controller, db, _, _) = NewController(classifierFails: true);

        var result = await controller.Import("Mi cafetería", ValidFile(), default);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status.StatusCode);
        Assert.Equal("La IA falló.", status.Value);
        Assert.Empty(db.BudgetProjects);
        Assert.Empty(db.BudgetItems);
    }

    [Fact]
    public async Task Import_WithInvalidRows_ReturnsBadRequestWithoutCallingTheAi()
    {
        var (controller, db, _, classifier) = NewController();
        var stream = TestHelpers.NewBudgetExcel(
            ["Nombre", "Categoría", "Monto estimado"],
            ["Carne", "Insumos", "mucho"]);
        var file = new FormFile(stream, 0, stream.Length, "file", "presupuesto.xlsx");

        var result = await controller.Import("Mi cafetería", file, default);

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("Fila 2", (string)bad.Value!);
        Assert.Equal(0, classifier.Calls);
        Assert.Empty(db.BudgetProjects);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task Import_WithoutName_ReturnsBadRequest(string? name)
    {
        var (controller, _, _, _) = NewController();

        var result = await controller.Import(name, ValidFile(), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Import_WithoutFile_ReturnsBadRequest()
    {
        var (controller, _, _, _) = NewController();

        var result = await controller.Import("Mi cafetería", null, default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Theory]
    [InlineData("presupuesto.xls")]
    [InlineData("presupuesto.csv")]
    public async Task Import_WithOtherFormat_ReturnsBadRequest(string fileName)
    {
        var (controller, _, _, classifier) = NewController();

        var result = await controller.Import("Mi cafetería", ValidFile(fileName), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, classifier.Calls);
    }

    [Fact]
    public async Task List_OnlyReturnsOwnProjects()
    {
        var (controller, db, userId, _) = NewController();
        await SeedProject(db, userId);
        await SeedProject(db, Guid.NewGuid());

        var result = await controller.List();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsType<IReadOnlyList<BudgetProjectSummaryDto>>(ok.Value, exactMatch: false);
        Assert.Equal(1, Assert.Single(list).ItemCount);
    }

    [Fact]
    public async Task Get_OtherUsersProject_ReturnsNotFound()
    {
        var (controller, db, _, _) = NewController();
        var other = await SeedProject(db, Guid.NewGuid());

        var result = await controller.Get(other.Id);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task UpdateItemType_ChangesType()
    {
        var (controller, db, userId, _) = NewController();
        var project = await SeedProject(db, userId);
        var item = project.Items.Single();

        var result = await controller.UpdateItemType(project.Id, item.Id, new UpdateBudgetItemTypeRequest(BudgetItemType.Liability));

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(BudgetItemType.Liability, db.BudgetItems.Single().Type);
    }

    [Fact]
    public async Task UpdateItemType_OtherUsersItem_ReturnsNotFoundAndKeepsType()
    {
        var (controller, db, _, _) = NewController();
        var other = await SeedProject(db, Guid.NewGuid());
        var item = other.Items.Single();

        var result = await controller.UpdateItemType(other.Id, item.Id, new UpdateBudgetItemTypeRequest(BudgetItemType.Liability));

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Equal(BudgetItemType.Asset, db.BudgetItems.Single().Type);
    }

    private static async Task SeedQuotedProjects(AppDbContext db, Guid userId, int count, DateTime quotedAt)
    {
        for (var i = 0; i < count; i++)
        {
            var project = await SeedProject(db, userId);
            project.Items.Single().AiQuoteSummary = "Rango: $1 - $2 CLP. Proveedores sugeridos: Tienda.";
            project.Items.Single().AiQuotedAt = quotedAt;
        }
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task QuoteItem_SavesAnswerAndDateAndKeepsEstimatedAmount()
    {
        var (controller, db, userId, _, quoter) = NewControllerWithQuoter();
        var project = await SeedProject(db, userId);
        var item = project.Items.Single();

        var result = await controller.QuoteItem(project.Id, item.Id, default);

        var dto = Assert.IsType<BudgetItemDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Contains("Tienda de Carne", dto.AiQuoteSummary);
        Assert.NotNull(dto.AiQuotedAt);
        Assert.Equal(1000m, dto.EstimatedAmount);
        Assert.Equal(1, quoter.Calls);
        Assert.Contains("Tienda de Carne", db.BudgetItems.Single().AiQuoteSummary);
    }

    private static async Task<BudgetProject> SeedMixedProject(AppDbContext db, Guid userId)
    {
        BudgetItem Item(string name, BudgetItemType type) => new() { Name = name, Type = type, Category = "Varios", EstimatedAmount = 1m };
        var project = new BudgetProject
        {
            UserId = userId,
            Name = "Pollería: Don Juan!",
            Items =
            {
                Item("luz", BudgetItemType.Liability),
                Item("Servilletas", BudgetItemType.Asset),
                Item("Arriendo", BudgetItemType.Liability),
                Item("Ázucar", BudgetItemType.Asset),
                Item("carne", BudgetItemType.Asset),
            },
        };
        db.BudgetProjects.Add(project);
        await db.SaveChangesAsync();
        return project;
    }

    [Fact]
    public async Task Get_ShowsAssetsFirstEachGroupFromAToZ()
    {
        var (controller, db, userId, _) = NewController();
        var project = await SeedMixedProject(db, userId);

        var result = await controller.Get(project.Id);

        var dto = Assert.IsType<BudgetProjectDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(["Ázucar", "carne", "Servilletas", "Arriendo", "luz"], dto.Items.Select(i => i.Name));
    }

    [Fact]
    public async Task QuoteItem_ReturnsTheQuoteSplitIntoBlocks()
    {
        var (controller, db, userId, _, _) = NewControllerWithQuoter();
        var project = await SeedProject(db, userId);
        db.BudgetItems.Single().AiQuoteSummary = "Rango: $1 CLP. Mejor precio-calidad: Marca. Proveedores sugeridos: Lider.";
        db.BudgetItems.Single().AiQuotedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var result = await controller.QuoteItem(project.Id, project.Items.Single().Id, default);

        var dto = Assert.IsType<BudgetItemDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal("Marca", dto.Quote!.BestValue);
    }

    [Fact]
    public async Task Export_ReturnsExcelInTheSameOrderAsTheTable()
    {
        var (controller, db, userId, _) = NewController();
        var project = await SeedMixedProject(db, userId);

        var result = await controller.Export(project.Id);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", file.ContentType);
        Assert.Equal("Presupuesto actualizado - Pollería Don Juan.xlsx", file.FileDownloadName);

        using var workbook = new ClosedXML.Excel.XLWorkbook(new MemoryStream(file.FileContents));
        var names = Enumerable.Range(BudgetExcelWriter.FirstDataRow, 5).Select(r => workbook.Worksheet(1).Cell(r, 1).GetString());
        Assert.Equal(["Ázucar", "carne", "Servilletas", "Arriendo", "luz"], names);
    }

    [Fact]
    public async Task Export_OtherUsersProject_ReturnsNotFound()
    {
        var (controller, db, _, _) = NewController();
        var other = await SeedProject(db, Guid.NewGuid());

        var result = await controller.Export(other.Id);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task QuoteItem_Liability_ReturnsBadRequestWithoutCallingTheAi()
    {
        var (controller, db, userId, _, quoter) = NewControllerWithQuoter();
        var project = await SeedProject(db, userId);
        var item = project.Items.Single();
        item.Type = BudgetItemType.Liability;
        await db.SaveChangesAsync();

        var result = await controller.QuoteItem(project.Id, item.Id, default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, quoter.Calls);
        Assert.Null(db.BudgetItems.Single().AiQuoteSummary);
    }

    [Fact]
    public async Task UpdateItemType_ToLiability_RemovesTheQuote()
    {
        var (controller, db, userId, _, _) = NewControllerWithQuoter();
        var project = await SeedProject(db, userId);
        var item = project.Items.Single();
        await controller.QuoteItem(project.Id, item.Id, default);

        await controller.UpdateItemType(project.Id, item.Id, new UpdateBudgetItemTypeRequest(BudgetItemType.Liability));

        Assert.Null(db.BudgetItems.Single().AiQuoteSummary);
        Assert.Null(db.BudgetItems.Single().AiQuotedAt);
    }

    [Fact]
    public async Task UpdateItemType_ToAsset_KeepsTheQuote()
    {
        var (controller, db, userId, _, _) = NewControllerWithQuoter();
        var project = await SeedProject(db, userId);
        var item = project.Items.Single();
        await controller.QuoteItem(project.Id, item.Id, default);

        await controller.UpdateItemType(project.Id, item.Id, new UpdateBudgetItemTypeRequest(BudgetItemType.Asset));

        Assert.NotNull(db.BudgetItems.Single().AiQuoteSummary);
    }

    [Fact]
    public async Task QuoteItem_OtherUsersItem_ReturnsNotFoundWithoutCallingTheAi()
    {
        var (controller, db, _, _, quoter) = NewControllerWithQuoter();
        var other = await SeedProject(db, Guid.NewGuid());

        var result = await controller.QuoteItem(other.Id, other.Items.Single().Id, default);

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Equal(0, quoter.Calls);
    }

    [Fact]
    public async Task QuoteItem_AlreadyQuotedToday_ReturnsSavedAnswerWithoutSpendingCredit()
    {
        var (controller, db, userId, _, quoter) = NewControllerWithQuoter();
        var project = await SeedProject(db, userId);
        var item = project.Items.Single();

        await controller.QuoteItem(project.Id, item.Id, default);
        var result = await controller.QuoteItem(project.Id, item.Id, default);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(1, quoter.Calls);
    }

    [Fact]
    public async Task QuoteItem_QuotedOnAnEarlierDay_QuotesAgain()
    {
        var (controller, db, userId, _, quoter) = NewControllerWithQuoter();
        var project = await SeedProject(db, userId);
        var item = project.Items.Single();
        item.AiQuotedAt = DateTime.UtcNow.AddDays(-2);
        await db.SaveChangesAsync();

        await controller.QuoteItem(project.Id, item.Id, default);

        Assert.Equal(1, quoter.Calls);
    }

    [Fact]
    public async Task QuoteItem_WhenQuoterFails_Returns503AndSavesNothing()
    {
        var (controller, db, userId, _, quoter) = NewControllerWithQuoter();
        quoter.Fail = true;
        var project = await SeedProject(db, userId);

        var result = await controller.QuoteItem(project.Id, project.Items.Single().Id, default);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status.StatusCode);
        Assert.Null(db.BudgetItems.Single().AiQuoteSummary);
        Assert.Null(db.BudgetItems.Single().AiQuotedAt);
    }

    [Fact]
    public async Task QuoteItem_FourthBudgetOfTheDay_IsRejected()
    {
        var (controller, db, userId, _, quoter) = NewControllerWithQuoter();
        await SeedQuotedProjects(db, userId, BudgetProjectsController.MaxQuotedProjectsPerDay, DateTime.UtcNow);
        var fourth = await SeedProject(db, userId);

        var result = await controller.QuoteItem(fourth.Id, fourth.Items.Single().Id, default);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status429TooManyRequests, status.StatusCode);
        Assert.Equal(0, quoter.Calls);
    }

    [Fact]
    public async Task QuoteItem_ThirdBudgetOfTheDay_CanFinishAllItsItems()
    {
        var (controller, db, userId, _, quoter) = NewControllerWithQuoter();
        await SeedQuotedProjects(db, userId, BudgetProjectsController.MaxQuotedProjectsPerDay - 1, DateTime.UtcNow);
        var third = await SeedProject(db, userId);
        var second = new BudgetItem { BudgetProjectId = third.Id, Name = "Pollo", Type = BudgetItemType.Asset, Category = "Insumos", EstimatedAmount = 1m };
        db.BudgetItems.Add(second);
        await db.SaveChangesAsync();

        var first = await controller.QuoteItem(third.Id, third.Items.First(i => i.Name == "Carne").Id, default);
        var next = await controller.QuoteItem(third.Id, second.Id, default);

        Assert.IsType<OkObjectResult>(first.Result);
        Assert.IsType<OkObjectResult>(next.Result);
        Assert.Equal(2, quoter.Calls);
    }

    [Fact]
    public async Task QuoteItem_LimitIgnoresOtherDaysAndOtherUsers()
    {
        var (controller, db, userId, _, quoter) = NewControllerWithQuoter();
        await SeedQuotedProjects(db, userId, BudgetProjectsController.MaxQuotedProjectsPerDay, DateTime.UtcNow.AddDays(-2));
        await SeedQuotedProjects(db, Guid.NewGuid(), BudgetProjectsController.MaxQuotedProjectsPerDay, DateTime.UtcNow);
        var project = await SeedProject(db, userId);

        var result = await controller.QuoteItem(project.Id, project.Items.Single().Id, default);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(1, quoter.Calls);
    }

    [Fact]
    public async Task UpdateItemType_WithUndefinedValue_ReturnsBadRequest()
    {
        var (controller, db, userId, _) = NewController();
        var project = await SeedProject(db, userId);

        var result = await controller.UpdateItemType(
            project.Id, project.Items.Single().Id, new UpdateBudgetItemTypeRequest((BudgetItemType)5));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    private static BudgetProject AddProjectFor(AppDbContext db, Guid userId)
    {
        var project = new BudgetProject { UserId = userId, Name = "Pollería" };
        project.Items.Add(new BudgetItem { Name = "Freidora", Category = "Cocina", Type = BudgetItemType.Asset, EstimatedAmount = 650_000m });
        db.BudgetProjects.Add(project);
        db.SaveChanges();
        return project;
    }

    [Fact]
    public async Task Delete_RemovesTheProjectItsItemsAndItsWalletCopy()
    {
        var (controller, db, userId, _) = NewController();
        var project = AddProjectFor(db, userId);
        var other = AddProjectFor(db, userId);
        db.PlannedItems.Add(new PlannedItem
        {
            UserId = userId, BudgetProjectId = project.Id, Name = "Freidora", Category = "Cocina",
            Type = BudgetItemType.Asset, Amount = 650_000m,
        });
        db.SaveChanges();

        var result = await controller.Delete(project.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(other.Id, Assert.Single(db.BudgetProjects).Id);
        Assert.Single(db.BudgetItems);
        Assert.Empty(db.PlannedItems);
    }

    [Fact]
    public async Task Delete_OfAnotherUser_ReturnsNotFound()
    {
        var (controller, db, _, _) = NewController();
        var project = AddProjectFor(db, Guid.NewGuid());

        var result = await controller.Delete(project.Id);

        Assert.IsType<NotFoundResult>(result);
        Assert.Single(db.BudgetProjects);
    }

    [Fact]
    public async Task Rename_ChangesTheTrimmedName()
    {
        var (controller, db, userId, _) = NewController();
        var project = AddProjectFor(db, userId);

        var result = await controller.Rename(project.Id, new RenameBudgetProjectRequest("  Pollería centro  "));

        var summary = Assert.IsType<BudgetProjectSummaryDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal("Pollería centro", summary.Name);
        Assert.Equal(1, summary.ItemCount);
        Assert.Equal("Pollería centro", db.BudgetProjects.Single().Name);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task Rename_WithoutAName_ReturnsBadRequest(string? name)
    {
        var (controller, db, userId, _) = NewController();
        var project = AddProjectFor(db, userId);

        var result = await controller.Rename(project.Id, new RenameBudgetProjectRequest(name));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Pollería", db.BudgetProjects.Single().Name);
    }

    [Fact]
    public async Task Rename_WithTooLongName_ReturnsBadRequest()
    {
        var (controller, db, userId, _) = NewController();
        var project = AddProjectFor(db, userId);

        var result = await controller.Rename(project.Id, new RenameBudgetProjectRequest(new string('a', BudgetExcelReader.MaxTextLength + 1)));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Rename_OfAnotherUser_ReturnsNotFound()
    {
        var (controller, db, _, _) = NewController();
        var project = AddProjectFor(db, Guid.NewGuid());

        var result = await controller.Rename(project.Id, new RenameBudgetProjectRequest("Ajeno"));

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Equal("Pollería", db.BudgetProjects.Single().Name);
    }
}
