using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Tests;

public class BudgetReviewsControllerTests
{
    private sealed class FakeReviewer : IBudgetReviewer
    {
        public bool Fail { get; init; }
        public int SuggestionCount { get; init; } = 2;
        public int Calls { get; private set; }
        public string? ReceivedName { get; private set; }
        public IReadOnlyList<BudgetItemToReview> ReceivedItems { get; private set; } = [];
        public string? ReceivedGoal { get; private set; }

        public Task<IReadOnlyList<BudgetSuggestion>> ReviewAsync(
            string budgetName, IReadOnlyList<BudgetItemToReview> items, string goal,
            CancellationToken cancellationToken = default)
        {
            Calls++;
            ReceivedGoal = goal;
            ReceivedName = budgetName;
            ReceivedItems = items;
            if (Fail) throw new BudgetReviewException("La IA falló.");
            IReadOnlyList<BudgetSuggestion> suggestions = Enumerable.Range(1, SuggestionCount)
                .Select(i => new BudgetSuggestion($"Sugerencia {i}", "Permisos", BudgetItemType.Liability, 50_000m, "Hace falta"))
                .ToList();
            return Task.FromResult(suggestions);
        }
    }

    private static (BudgetReviewsController controller, AppDbContext db, Guid userId, FakeReviewer reviewer) NewController(
        bool fail = false, int suggestionCount = 2)
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        var reviewer = new FakeReviewer { Fail = fail, SuggestionCount = suggestionCount };
        return (new BudgetReviewsController(db, TestHelpers.NewCurrentUser(userId), reviewer), db, userId, reviewer);
    }

    private static ReviewBudgetRequest Goal => new("Duplicar la venta de pollos");

    private static async Task<BudgetProject> SeedProject(AppDbContext db, Guid userId, int itemCount = 2)
    {
        var project = new BudgetProject { UserId = userId, Name = "Mi pollería" };
        for (var i = 1; i <= itemCount; i++)
            project.Items.Add(new BudgetItem { Name = $"Ítem {i}", Category = "Cocina", Type = BudgetItemType.Asset, EstimatedAmount = 1000m * i });
        db.BudgetProjects.Add(project);
        await db.SaveChangesAsync();
        return project;
    }

    [Fact]
    public async Task Review_SendsTheBudgetToTheAiAndReturnsSuggestionsWithoutSavingThem()
    {
        var (controller, db, userId, reviewer) = NewController();
        var project = await SeedProject(db, userId);

        var result = await controller.Review(project.Id, Goal, CancellationToken.None);

        var dto = Assert.IsType<BudgetReviewDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(2, dto.Suggestions.Count);
        Assert.Equal("Hace falta", dto.Suggestions[0].Reason);
        Assert.Equal(BudgetReviewsController.MaxReviewsPerDay - 1, dto.RemainingToday);
        Assert.Equal("Mi pollería", reviewer.ReceivedName);
        Assert.Equal(2, reviewer.ReceivedItems.Count);
        Assert.Equal("Duplicar la venta de pollos", reviewer.ReceivedGoal);
        Assert.Single(db.AiUsages, u => u.UserId == userId && u.Kind == AiUsage.BudgetReview);
        Assert.Equal(2, db.BudgetItems.Count());
    }

    [Fact]
    public async Task Review_AnotherUsersBudget_IsNotFoundAndSpendsNothing()
    {
        var (controller, db, _, reviewer) = NewController();
        var project = await SeedProject(db, Guid.NewGuid());

        var result = await controller.Review(project.Id, Goal, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Equal(0, reviewer.Calls);
        Assert.Empty(db.AiUsages);
    }

    [Fact]
    public async Task Review_AFullBudget_IsRejectedWithoutCallingTheAi()
    {
        var (controller, db, userId, reviewer) = NewController();
        var project = await SeedProject(db, userId, BudgetExcelReader.MaxItems);

        var result = await controller.Review(project.Id, Goal, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, reviewer.Calls);
        Assert.Empty(db.AiUsages);
    }

    [Fact]
    public async Task Review_NeverSuggestsMoreThanTheBudgetHasRoomFor()
    {
        var (controller, db, userId, _) = NewController(suggestionCount: 10);
        var project = await SeedProject(db, userId, BudgetExcelReader.MaxItems - 3);

        var result = await controller.Review(project.Id, Goal, CancellationToken.None);

        var dto = Assert.IsType<BudgetReviewDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(3, dto.Suggestions.Count);
    }

    [Fact]
    public async Task Review_OverTheDailyLimit_IsRejectedWithoutCallingTheAi()
    {
        var (controller, db, userId, reviewer) = NewController();
        var project = await SeedProject(db, userId);
        for (var i = 0; i < BudgetReviewsController.MaxReviewsPerDay; i++)
            db.AiUsages.Add(new AiUsage { UserId = userId, Kind = AiUsage.BudgetReview });
        await db.SaveChangesAsync();

        var result = await controller.Review(project.Id, Goal, CancellationToken.None);

        Assert.Equal(429, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        Assert.Equal(0, reviewer.Calls);
        Assert.Equal(BudgetReviewsController.MaxReviewsPerDay, db.AiUsages.Count(u => u.UserId == userId));
    }

    [Fact]
    public async Task Review_DoesNotShareTheLimitWithDescribeWithAi()
    {
        var (controller, db, userId, _) = NewController();
        var project = await SeedProject(db, userId);
        for (var i = 0; i < BudgetDraftsController.MaxDraftsPerDay; i++)
            db.AiUsages.Add(new AiUsage { UserId = userId, Kind = AiUsage.BudgetDraft });
        await db.SaveChangesAsync();

        var result = await controller.Review(project.Id, Goal, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task Review_WhenTheAiFails_Returns503AndStillCountsTheUse()
    {
        var (controller, db, userId, _) = NewController(fail: true);
        var project = await SeedProject(db, userId);

        var result = await controller.Review(project.Id, Goal, CancellationToken.None);

        Assert.Equal(503, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        Assert.Single(db.AiUsages);
    }

    [Fact]
    public async Task Review_WithAGoal_PassesItTrimmedToTheAi()
    {
        var (controller, db, userId, reviewer) = NewController();
        var project = await SeedProject(db, userId);

        var result = await controller.Review(
            project.Id, new ReviewBudgetRequest("  Duplicar la venta de papas y pollos  "), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal("Duplicar la venta de papas y pollos", reviewer.ReceivedGoal);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("papa")]
    public async Task Review_WithoutAGoal_IsRejectedWithoutSpendingAnything(string? goal)
    {
        var (controller, db, userId, reviewer) = NewController();
        var project = await SeedProject(db, userId);

        var result = await controller.Review(project.Id, new ReviewBudgetRequest(goal), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, reviewer.Calls);
        Assert.Empty(db.AiUsages);
    }

    [Fact]
    public async Task Review_WithNoBodyAtAll_IsRejected()
    {
        var (controller, db, userId, reviewer) = NewController();
        var project = await SeedProject(db, userId);

        var result = await controller.Review(project.Id, null, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, reviewer.Calls);
    }

    [Fact]
    public async Task Review_WithATooLongGoal_IsRejectedWithoutSpendingAnything()
    {
        var (controller, db, userId, reviewer) = NewController();
        var project = await SeedProject(db, userId);

        var result = await controller.Review(
            project.Id, new ReviewBudgetRequest(new string('a', BudgetReviewsController.MaxGoalLength + 1)), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, reviewer.Calls);
        Assert.Empty(db.AiUsages);
    }
}
