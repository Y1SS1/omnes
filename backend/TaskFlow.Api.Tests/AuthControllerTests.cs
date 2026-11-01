using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Dtos;
using Xunit;

namespace TaskFlow.Api.Tests;

public class AuthControllerTests
{
    private static AuthController NewController(out Data.AppDbContext db)
    {
        db = TestHelpers.NewDbContext();
        return new AuthController(db, TestHelpers.NewJwtService());
    }

    [Fact]
    public async Task Register_WithNewEmail_CreatesUserAndReturnsToken()
    {
        var controller = NewController(out var db);

        var result = await controller.Register(new RegisterRequest("ana@example.com", "Secret123!", "Ana"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<AuthResponse>(ok.Value);
        Assert.Equal("ana@example.com", body.Email);
        Assert.False(string.IsNullOrWhiteSpace(body.Token));
        Assert.Equal(1, db.Users.Count());
    }

    [Fact]
    public async Task Register_SeedsDefaultWalletAndCategories()
    {
        var controller = NewController(out var db);

        await controller.Register(new RegisterRequest("ana@example.com", "Secret123!", "Ana"));
        var user = db.Users.Single();

        Assert.Single(db.Wallets.Where(w => w.UserId == user.Id));
        Assert.True(db.Categories.Count(c => c.UserId == user.Id) >= 10);
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_ReturnsConflict()
    {
        var controller = NewController(out _);
        await controller.Register(new RegisterRequest("ana@example.com", "Secret123!", "Ana"));

        var result = await controller.Register(new RegisterRequest("ANA@example.com", "Other123!", "Ana 2"));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Register_WithoutPassword_ReturnsBadRequest()
    {
        var controller = NewController(out _);

        var result = await controller.Register(new RegisterRequest("ana@example.com", "", "Ana"));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task RegisterWorker_GeneratesCompanyEmailFromNames()
    {
        var controller = NewController(out _);

        var result = await controller.RegisterWorker(new RegisterWorkerRequest("Carlos", "Soto", "Secret123!"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<AuthResponse>(ok.Value);
        Assert.Equal("csoto@omnes.cl", body.Email);
        Assert.Equal("Trabajador", body.Role);
    }

    [Fact]
    public async Task RegisterWorker_WithRepeatedName_AppendsSuffixToEmail()
    {
        var controller = NewController(out _);
        await controller.RegisterWorker(new RegisterWorkerRequest("Carlos", "Soto", "Secret123!"));

        var result = await controller.RegisterWorker(new RegisterWorkerRequest("Carlos", "Soto", "Secret123!"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<AuthResponse>(ok.Value);
        Assert.Equal("csoto2@omnes.cl", body.Email);
    }

    [Fact]
    public async Task Login_WithCorrectCredentials_ReturnsToken()
    {
        var controller = NewController(out _);
        await controller.Register(new RegisterRequest("ana@example.com", "Secret123!", "Ana"));

        var result = await controller.Login(new LoginRequest("ana@example.com", "Secret123!"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<AuthResponse>(ok.Value);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        var controller = NewController(out _);
        await controller.Register(new RegisterRequest("ana@example.com", "Secret123!", "Ana"));

        var result = await controller.Login(new LoginRequest("ana@example.com", "wrong-password"));

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
    }

    [Fact]
    public async Task Login_WithUnknownEmail_ReturnsUnauthorized()
    {
        var controller = NewController(out _);

        var result = await controller.Login(new LoginRequest("nadie@example.com", "whatever"));

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
    }
}
