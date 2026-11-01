using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Route("api/workers")]
[Authorize(Roles = "Admin")]
public class WorkersController : ControllerBase
{
    private readonly AppDbContext _db;

    public WorkersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkerDto>>> GetWorkers()
    {
        var workers = await _db.Users
            .Where(u => u.Role == UserRole.Trabajador)
            .OrderBy(u => u.DisplayName)
            .Select(u => new WorkerDto(u.Id, u.Email, u.DisplayName, u.JobTitle, u.CreatedAt))
            .ToListAsync();
        return Ok(workers);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<WorkerDto>> UpdateWorker(Guid id, UpdateWorkerRequest req)
    {
        var worker = await _db.Users.FirstOrDefaultAsync(u => u.Id == id && u.Role == UserRole.Trabajador);
        if (worker is null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.DisplayName) || string.IsNullOrWhiteSpace(req.Email))
            return BadRequest("Nombre y correo son obligatorios.");

        var email = req.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Id != id && u.Email == email))
            return Conflict("Ya existe una cuenta con ese correo.");

        worker.DisplayName = req.DisplayName.Trim();
        worker.Email = email;
        worker.JobTitle = string.IsNullOrWhiteSpace(req.JobTitle) ? null : req.JobTitle.Trim();
        await _db.SaveChangesAsync();

        return Ok(new WorkerDto(worker.Id, worker.Email, worker.DisplayName, worker.JobTitle, worker.CreatedAt));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteWorker(Guid id)
    {
        var worker = await _db.Users.FirstOrDefaultAsync(u => u.Id == id && u.Role == UserRole.Trabajador);
        if (worker is null) return NotFound();

        _db.Users.Remove(worker);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
