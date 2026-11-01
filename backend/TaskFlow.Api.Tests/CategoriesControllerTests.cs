using Microsoft.AspNetCore.Mvc;
using TaskFlow.Api.Controllers;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using Xunit;

namespace TaskFlow.Api.Tests;

public class CategoriesControllerTests
{
    private static (CategoriesController controller, AppDbContext db, Guid userId) NewController()
    {
        var db = TestHelpers.NewDbContext();
        var userId = Guid.NewGuid();
        var controller = new CategoriesController(db, TestHelpers.NewCurrentUser(userId));
        return (controller, db, userId);
    }

    [Fact]
    public async Task Create_AddsCategoryForCurrentUser()
    {
        var (controller, db, userId) = NewController();

        var result = await controller.Create(new CreateCategoryRequest("Salud", "#EF4444", CategoryType.Task));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<CategoryDto>(ok.Value);
        Assert.Equal("Salud", dto.Name);
        Assert.Single(db.Categories.Where(c => c.UserId == userId));
    }

    [Fact]
    public async Task GetAll_OnlyReturnsCurrentUsersCategories()
    {
        var (controller, db, userId) = NewController();
        db.Categories.Add(new Category { UserId = userId, Name = "Mía", Color = "#000", Type = CategoryType.Task });
        db.Categories.Add(new Category { UserId = Guid.NewGuid(), Name = "De otro", Color = "#fff", Type = CategoryType.Task });
        await db.SaveChangesAsync();

        var result = await controller.GetAll(null);

        var list = Assert.IsAssignableFrom<List<CategoryDto>>(result.Value);
        Assert.Single(list);
        Assert.Equal("Mía", list[0].Name);
    }

    [Fact]
    public async Task GetAll_FiltersByType()
    {
        var (controller, db, userId) = NewController();
        db.Categories.Add(new Category { UserId = userId, Name = "Tarea", Color = "#000", Type = CategoryType.Task });
        db.Categories.Add(new Category { UserId = userId, Name = "Gasto", Color = "#fff", Type = CategoryType.Expense });
        await db.SaveChangesAsync();

        var result = await controller.GetAll(CategoryType.Expense);

        var list = Assert.IsAssignableFrom<List<CategoryDto>>(result.Value);
        Assert.Single(list);
        Assert.Equal("Gasto", list[0].Name);
    }

    [Fact]
    public async Task GetAll_RequestingIncome_SeedsDefaultIncomeCategoriesOnce()
    {
        var (controller, db, userId) = NewController();

        var first = await controller.GetAll(CategoryType.Income);
        var second = await controller.GetAll(CategoryType.Income);

        Assert.True(Assert.IsAssignableFrom<List<CategoryDto>>(first.Value).Count >= 5);
        // calling it again must not duplicate the seeded categories
        Assert.Equal(
            Assert.IsAssignableFrom<List<CategoryDto>>(first.Value).Count,
            Assert.IsAssignableFrom<List<CategoryDto>>(second.Value).Count
        );
    }

    [Fact]
    public async Task Delete_RemovesOwnCategory()
    {
        var (controller, db, userId) = NewController();
        var category = new Category { UserId = userId, Name = "Salud", Color = "#EF4444", Type = CategoryType.Task };
        db.Categories.Add(category);
        await db.SaveChangesAsync();

        var result = await controller.Delete(category.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.Categories.Where(c => c.UserId == userId));
    }

    [Fact]
    public async Task Delete_SomeoneElsesCategory_ReturnsNotFound()
    {
        var (controller, db, _) = NewController();
        var category = new Category { UserId = Guid.NewGuid(), Name = "Ajena", Color = "#EF4444", Type = CategoryType.Task };
        db.Categories.Add(category);
        await db.SaveChangesAsync();

        var result = await controller.Delete(category.Id);

        Assert.IsType<NotFoundResult>(result);
    }
}
