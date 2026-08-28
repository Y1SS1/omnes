using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;

    public CategoriesController(AppDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<List<CategoryDto>>> GetAll([FromQuery] CategoryType? type)
    {
        // Self-heal accounts created before income categories existed: seed them
        // the first time they're requested instead of requiring a data migration.
        if (type == CategoryType.Income)
        {
            var hasIncome = await _db.Categories.AnyAsync(c => c.UserId == _currentUser.UserId && c.Type == CategoryType.Income);
            if (!hasIncome)
            {
                _db.Categories.AddRange(
                    new Category { UserId = _currentUser.UserId, Name = "Sueldo", Color = "#10B981", Type = CategoryType.Income },
                    new Category { UserId = _currentUser.UserId, Name = "Regalo", Color = "#F59E0B", Type = CategoryType.Income },
                    new Category { UserId = _currentUser.UserId, Name = "Reembolso", Color = "#3B82F6", Type = CategoryType.Income },
                    new Category { UserId = _currentUser.UserId, Name = "Venta", Color = "#8B5CF6", Type = CategoryType.Income },
                    new Category { UserId = _currentUser.UserId, Name = "Otros ingresos", Color = "#6B7280", Type = CategoryType.Income }
                );
                await _db.SaveChangesAsync();
            }
        }

        var query = _db.Categories.Where(c => c.UserId == _currentUser.UserId);
        if (type.HasValue) query = query.Where(c => c.Type == type.Value);
        var categories = await query.OrderBy(c => c.Name).ToListAsync();
        return categories.Select(c => new CategoryDto(c.Id, c.Name, c.Color, c.Type)).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create(CreateCategoryRequest req)
    {
        var category = new Category
        {
            UserId = _currentUser.UserId,
            Name = req.Name,
            Color = req.Color,
            Type = req.Type
        };
        _db.Categories.Add(category);
        await _db.SaveChangesAsync();
        return Ok(new CategoryDto(category.Id, category.Name, category.Color, category.Type));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id && c.UserId == _currentUser.UserId);
        if (category is null) return NotFound();
        _db.Categories.Remove(category);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
