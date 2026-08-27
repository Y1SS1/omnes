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
