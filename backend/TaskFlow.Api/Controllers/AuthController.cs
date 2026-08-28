using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtTokenService _jwt;

    public AuthController(AppDbContext db, JwtTokenService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest("Email y contraseña son obligatorios.");

        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict("Ya existe una cuenta con ese correo.");

        var user = new User
        {
            Email = req.Email.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            DisplayName = string.IsNullOrWhiteSpace(req.DisplayName) ? req.Email : req.DisplayName
        };
        _db.Users.Add(user);

        _db.Wallets.Add(new Wallet { UserId = user.Id, Balance = 0, SavingsFund = 0 });

        _db.Categories.AddRange(
            new Category { UserId = user.Id, Name = "Trámites", Color = "#3B82F6", Type = CategoryType.Task },
            new Category { UserId = user.Id, Name = "Personal", Color = "#8B5CF6", Type = CategoryType.Task },
            new Category { UserId = user.Id, Name = "Salud", Color = "#EF4444", Type = CategoryType.Task },
            new Category { UserId = user.Id, Name = "Estudio", Color = "#F59E0B", Type = CategoryType.Task },
            new Category { UserId = user.Id, Name = "Supermercado", Color = "#10B981", Type = CategoryType.Expense },
            new Category { UserId = user.Id, Name = "Transporte", Color = "#3B82F6", Type = CategoryType.Expense },
            new Category { UserId = user.Id, Name = "Ropa", Color = "#EC4899", Type = CategoryType.Expense },
            new Category { UserId = user.Id, Name = "Entretenimiento", Color = "#8B5CF6", Type = CategoryType.Expense },
            new Category { UserId = user.Id, Name = "Otros", Color = "#6B7280", Type = CategoryType.Expense },
            new Category { UserId = user.Id, Name = "Sueldo", Color = "#10B981", Type = CategoryType.Income },
            new Category { UserId = user.Id, Name = "Regalo", Color = "#F59E0B", Type = CategoryType.Income },
            new Category { UserId = user.Id, Name = "Reembolso", Color = "#3B82F6", Type = CategoryType.Income },
            new Category { UserId = user.Id, Name = "Venta", Color = "#8B5CF6", Type = CategoryType.Income },
            new Category { UserId = user.Id, Name = "Otros ingresos", Color = "#6B7280", Type = CategoryType.Income }
        );

        await _db.SaveChangesAsync();

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponse(token, user.Id, user.Email, user.DisplayName));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.Trim().ToLowerInvariant());
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized("Credenciales inválidas.");

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponse(token, user.Id, user.Email, user.DisplayName));
    }
}
