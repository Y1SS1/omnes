using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Tests;

public class BudgetDraftsControllerTests
{
    private sealed class FakeDrafter : IBudgetDrafter
    {
        public bool Fail { get; init; }
        public int Calls { get; private set; }
        public decimal? ReceivedTarget { get; private set; }

        public Task<IReadOnlyList<BudgetDraftItem>> DraftAsync(
            string description, decimal? targetAmount, CancellationToken cancellationToken = default)
        {
            Calls++;
            ReceivedTarget = targetAmount;
            if (Fail) throw new BudgetDraftException("La IA falló.");
            IReadOnlyList<BudgetDraftItem> items =
            [
                new("Freidora industrial 2 canastos", "Cocina", BudgetItemType.Asset, 650_000m),
                new("Arriendo del local (mensual)", "Gastos fijos", BudgetItemType.Liability, 850_000m),
            ];
            return Task.FromResult(items);
        }
    }

    private static (BudgetDraftsController controller, AppDbContext db, Guid userId, FakeDrafter drafter) NewController(bool fail = false)
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        var drafter = new FakeDrafter { Fail = fail };
        return (new BudgetDraftsController(db, TestHelpers.NewCurrentUser(userId), drafter), db, userId, drafter);
    }

    private static DraftBudgetRequest Valid(decimal? target = null) =>
        new("Quiero abrir una pollería pequeña para 20 personas", target);

    [Fact]
    public async Task Draft_ReturnsTheProposalAndCountsTheUse()
    {
        var (controller, db, userId, drafter) = NewController();

        var result = await controller.Draft(Valid(8_000_000m), CancellationToken.None);

        var dto = Assert.IsType<BudgetDraftDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(2, dto.Items.Count);
        Assert.Equal(BudgetDraftsController.MaxDraftsPerDay - 1, dto.RemainingToday);
        Assert.Equal(8_000_000m, drafter.ReceivedTarget);
        Assert.Single(db.AiUsages, u => u.UserId == userId && u.Kind == AiUsage.BudgetDraft);
        Assert.Empty(db.BudgetProjects);
    }

    [Theory]
    [InlineData("corto")]
    [InlineData("          ")]
    public async Task Draft_WithTooShortDescription_ReturnsBadRequestWithoutCallingTheAi(string description)
    {
        var (controller, db, _, drafter) = NewController();

        var result = await controller.Draft(new DraftBudgetRequest(description, null), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, drafter.Calls);
        Assert.Empty(db.AiUsages);
    }

    [Fact]
    public async Task Draft_WithTooLongDescription_ReturnsBadRequest()
    {
        var (controller, _, _, drafter) = NewController();

        var result = await controller.Draft(
            new DraftBudgetRequest(new string('a', BudgetDraftsController.MaxDescriptionLength + 1), null), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, drafter.Calls);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task Draft_WithInvalidTargetAmount_ReturnsBadRequest(decimal target)
    {
        var (controller, _, _, drafter) = NewController();

        var result = await controller.Draft(Valid(target), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, drafter.Calls);
    }

    [Fact]
    public async Task Draft_AfterTheDailyLimit_Returns429WithoutCallingTheAi()
    {
        var (controller, db, userId, drafter) = NewController();
        for (var i = 0; i < BudgetDraftsController.MaxDraftsPerDay; i++)
            db.AiUsages.Add(new AiUsage { UserId = userId, Kind = AiUsage.BudgetDraft });
        db.SaveChanges();

        var result = await controller.Draft(Valid(), CancellationToken.None);

        Assert.Equal(StatusCodes.Status429TooManyRequests, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        Assert.Equal(0, drafter.Calls);
        // The rejected attempt removes its own record, so it does not eat into tomorrow's view either.
        Assert.Equal(BudgetDraftsController.MaxDraftsPerDay, db.AiUsages.Count(u => u.UserId == userId));
    }

    [Fact]
    public async Task Draft_TheLastOfTheDay_IsAllowed()
    {
        var (controller, db, userId, drafter) = NewController();
        for (var i = 0; i < BudgetDraftsController.MaxDraftsPerDay - 1; i++)
            db.AiUsages.Add(new AiUsage { UserId = userId, Kind = AiUsage.BudgetDraft });
        db.SaveChanges();

        var result = await controller.Draft(Valid(), CancellationToken.None);

        var dto = Assert.IsType<BudgetDraftDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(0, dto.RemainingToday);
        Assert.Equal(1, drafter.Calls);
        Assert.Equal(BudgetDraftsController.MaxDraftsPerDay, db.AiUsages.Count(u => u.UserId == userId));
    }

    [Fact]
    public async Task Draft_WhenASimultaneousRequestTookTheLastSlot_IsRejectedWithoutCallingTheAi()
    {
        // Nine earlier uses plus one from a request running at the same moment, already saved
        // but not yet answered: this request must not become an eleventh.
        var (controller, db, userId, drafter) = NewController();
        for (var i = 0; i < BudgetDraftsController.MaxDraftsPerDay; i++)
            db.AiUsages.Add(new AiUsage { UserId = userId, Kind = AiUsage.BudgetDraft });
        db.SaveChanges();

        var result = await controller.Draft(Valid(), CancellationToken.None);

        Assert.Equal(StatusCodes.Status429TooManyRequests, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        Assert.Equal(0, drafter.Calls);
        Assert.Equal(BudgetDraftsController.MaxDraftsPerDay, db.AiUsages.Count(u => u.UserId == userId));
    }

    [Fact]
    public async Task Draft_IgnoresYesterdaysAndOtherUsersUses()
    {
        var (controller, db, userId, _) = NewController();
        for (var i = 0; i < BudgetDraftsController.MaxDraftsPerDay; i++)
        {
            db.AiUsages.Add(new AiUsage { UserId = userId, Kind = AiUsage.BudgetDraft, CreatedAt = DateTime.UtcNow.AddDays(-2) });
            db.AiUsages.Add(new AiUsage { UserId = Guid.NewGuid(), Kind = AiUsage.BudgetDraft });
        }
        db.SaveChanges();

        var result = await controller.Draft(Valid(), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task Draft_WhenTheAiFails_Returns503AndStillCountsTheUse()
    {
        var (controller, db, userId, _) = NewController(fail: true);

        var result = await controller.Draft(Valid(), CancellationToken.None);

        var error = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, error.StatusCode);
        Assert.Equal("La IA falló.", error.Value);
        Assert.Single(db.AiUsages, u => u.UserId == userId);
    }
}
