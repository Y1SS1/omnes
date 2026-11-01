using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using Xunit;

namespace TaskFlow.Api.Tests;

public class WorkersControllerTests
{
    private static (WorkersController controller, AppDbContext db) NewController()
    {
        var db = TestHelpers.NewDbContext();
        return (new WorkersController(db), db);
    }

    [Fact]
    public async Task GetWorkers_OnlyReturnsTrabajadorRole_OrderedByName()
    {
        var (controller, db) = NewController();
        db.Users.Add(new User { Email = "b@example.com", PasswordHash = "x", DisplayName = "Beto", Role = UserRole.Trabajador });
        db.Users.Add(new User { Email = "a@example.com", PasswordHash = "x", DisplayName = "Ana", Role = UserRole.Trabajador });
        db.Users.Add(new User { Email = "jefe@example.com", PasswordHash = "x", DisplayName = "Jefe", Role = UserRole.Admin });
        await db.SaveChangesAsync();

        var result = await controller.GetWorkers();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsType<List<WorkerDto>>(ok.Value);
        Assert.Equal(2, list.Count);
        Assert.Equal("Ana", list[0].DisplayName);
        Assert.Equal("Beto", list[1].DisplayName);
    }

    [Fact]
    public async Task UpdateWorker_UpdatesFields()
    {
        var (controller, db) = NewController();
        var worker = new User { Email = "old@example.com", PasswordHash = "x", DisplayName = "Viejo", Role = UserRole.Trabajador };
        db.Users.Add(worker);
        await db.SaveChangesAsync();

        var result = await controller.UpdateWorker(worker.Id, new UpdateWorkerRequest("Nuevo", "new@example.com", "Soporte"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<WorkerDto>(ok.Value);
        Assert.Equal("Nuevo", dto.DisplayName);
        Assert.Equal("new@example.com", dto.Email);
        Assert.Equal("Soporte", dto.JobTitle);
    }

    [Fact]
    public async Task UpdateWorker_UnknownId_ReturnsNotFound()
    {
        var (controller, _) = NewController();

        var result = await controller.UpdateWorker(Guid.NewGuid(), new UpdateWorkerRequest("X", "x@example.com", null));

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task UpdateWorker_WithoutDisplayName_ReturnsBadRequest()
    {
        var (controller, db) = NewController();
        var worker = new User { Email = "old@example.com", PasswordHash = "x", DisplayName = "Viejo", Role = UserRole.Trabajador };
        db.Users.Add(worker);
        await db.SaveChangesAsync();

        var result = await controller.UpdateWorker(worker.Id, new UpdateWorkerRequest("", "new@example.com", null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UpdateWorker_EmailAlreadyUsedByAnotherUser_ReturnsConflict()
    {
        var (controller, db) = NewController();
        db.Users.Add(new User { Email = "taken@example.com", PasswordHash = "x", DisplayName = "Otro", Role = UserRole.Trabajador });
        var worker = new User { Email = "old@example.com", PasswordHash = "x", DisplayName = "Viejo", Role = UserRole.Trabajador };
        db.Users.Add(worker);
        await db.SaveChangesAsync();

        var result = await controller.UpdateWorker(worker.Id, new UpdateWorkerRequest("Nuevo", "taken@example.com", null));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task DeleteWorker_RemovesTrabajador()
    {
        var (controller, db) = NewController();
        var worker = new User { Email = "worker@example.com", PasswordHash = "x", DisplayName = "Worker", Role = UserRole.Trabajador };
        db.Users.Add(worker);
        await db.SaveChangesAsync();

        var result = await controller.DeleteWorker(worker.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.Users.Where(u => u.Id == worker.Id));
    }

    [Fact]
    public async Task DeleteWorker_CannotDeleteAdmin()
    {
        var (controller, db) = NewController();
        var admin = new User { Email = "jefe@example.com", PasswordHash = "x", DisplayName = "Jefe", Role = UserRole.Admin };
        db.Users.Add(admin);
        await db.SaveChangesAsync();

        var result = await controller.DeleteWorker(admin.Id);

        Assert.IsType<NotFoundResult>(result);
    }
}
