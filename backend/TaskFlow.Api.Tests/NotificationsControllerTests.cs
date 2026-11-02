using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using Xunit;

namespace TaskFlow.Api.Tests;

public class NotificationsControllerTests
{
    private static (NotificationsController controller, AppDbContext db, Guid userId) NewController()
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        var controller = new NotificationsController(db, TestHelpers.NewCurrentUser(userId));
        return (controller, db, userId);
    }

    [Fact]
    public async Task GetAll_OnlyReturnsCurrentUsersNotifications_NewestFirst()
    {
        var (controller, db, userId) = NewController();
        db.Notifications.Add(new Notification { UserId = userId, Message = "Primera", CreatedAt = DateTime.UtcNow.AddMinutes(-10) });
        db.Notifications.Add(new Notification { UserId = userId, Message = "Segunda", CreatedAt = DateTime.UtcNow });
        db.Notifications.Add(new Notification { UserId = Guid.NewGuid(), Message = "Ajena", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var result = await controller.GetAll();

        var list = Assert.IsType<List<NotificationDto>>(result.Value, exactMatch: false);
        Assert.Equal(2, list.Count);
        Assert.Equal("Segunda", list[0].Message);
    }

    [Fact]
    public async Task MarkRead_SetsIsReadTrue()
    {
        var (controller, db, userId) = NewController();
        var n = new Notification { UserId = userId, Message = "Hola" };
        db.Notifications.Add(n);
        await db.SaveChangesAsync();

        var result = await controller.MarkRead(n.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.True(db.Notifications.Single(x => x.Id == n.Id).IsRead);
    }

    [Fact]
    public async Task MarkRead_SomeoneElsesNotification_ReturnsNotFound()
    {
        var (controller, db, _) = NewController();
        var n = new Notification { UserId = Guid.NewGuid(), Message = "Ajena" };
        db.Notifications.Add(n);
        await db.SaveChangesAsync();

        var result = await controller.MarkRead(n.Id);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Delete_RemovesOnlyThatNotification()
    {
        var (controller, db, userId) = NewController();
        var n1 = new Notification { UserId = userId, Message = "Uno" };
        var n2 = new Notification { UserId = userId, Message = "Dos" };
        db.Notifications.AddRange(n1, n2);
        await db.SaveChangesAsync();

        await controller.Delete(n1.Id);

        Assert.Single(db.Notifications.Where(n => n.UserId == userId));
    }

    [Fact]
    public async Task DeleteAll_RemovesOnlyCurrentUsersNotifications()
    {
        var (controller, db, userId) = NewController();
        db.Notifications.Add(new Notification { UserId = userId, Message = "Mía" });
        db.Notifications.Add(new Notification { UserId = Guid.NewGuid(), Message = "Ajena" });
        await db.SaveChangesAsync();

        await controller.DeleteAll();

        Assert.Empty(db.Notifications.Where(n => n.UserId == userId));
        Assert.Single(db.Notifications);
    }
}
