using System.Globalization;
using System.Text;
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
    private const string WorkerEmailDomain = "omnes.cl";

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

        var email = req.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return Conflict("Ya existe una cuenta con ese correo.");

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            DisplayName = string.IsNullOrWhiteSpace(req.DisplayName) ? req.Email : req.DisplayName,
            Role = email == AppConstants.AdminEmail ? UserRole.Admin : UserRole.Trabajador
        };
        _db.Users.Add(user);
        SeedNewUserData(user.Id);
        await _db.SaveChangesAsync();

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponse(token, user.Id, user.Email, user.DisplayName, user.Role.ToString(), user.JobTitle));
    }

    [HttpPost("register-worker")]
    public async Task<ActionResult<AuthResponse>> RegisterWorker(RegisterWorkerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FirstName) || string.IsNullOrWhiteSpace(req.LastName) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest("Nombre, apellido y contraseña son obligatorios.");

        var localPart = Slugify(req.FirstName).FirstOrDefault() + Slugify(req.LastName);
        if (string.IsNullOrEmpty(localPart))
            return BadRequest("Nombre o apellido inválido.");

        var email = $"{localPart}@{WorkerEmailDomain}";
        var suffix = 2;
        while (await _db.Users.AnyAsync(u => u.Email == email))
        {
            email = $"{localPart}{suffix}@{WorkerEmailDomain}";
            suffix++;
        }

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            DisplayName = $"{req.FirstName.Trim()} {req.LastName.Trim()}",
            Role = UserRole.Trabajador
        };
        _db.Users.Add(user);
        SeedNewUserData(user.Id);
        await _db.SaveChangesAsync();

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponse(token, user.Id, user.Email, user.DisplayName, user.Role.ToString(), user.JobTitle));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized("Credenciales inválidas.");

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponse(token, user.Id, user.Email, user.DisplayName, user.Role.ToString(), user.JobTitle));
    }

    private static string Slugify(string input)
    {
        var normalized = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;
            if (char.IsLetter(c))
                sb.Append(char.ToLowerInvariant(c));
        }
        return sb.ToString();
    }

    private void SeedNewUserData(Guid userId)
    {
        _db.Wallets.Add(new Wallet { UserId = userId, Balance = 0, SavingsFund = 0 });

        _db.Categories.AddRange(
            new Category { UserId = userId, Name = "Trámites", Color = "#3B82F6", Type = CategoryType.Task },
            new Category { UserId = userId, Name = "Personal", Color = "#8B5CF6", Type = CategoryType.Task },
            new Category { UserId = userId, Name = "Salud", Color = "#EF4444", Type = CategoryType.Task },
            new Category { UserId = userId, Name = "Estudio", Color = "#F59E0B", Type = CategoryType.Task },
            new Category { UserId = userId, Name = "Supermercado", Color = "#10B981", Type = CategoryType.Expense },
            new Category { UserId = userId, Name = "Transporte", Color = "#3B82F6", Type = CategoryType.Expense },
            new Category { UserId = userId, Name = "Ropa", Color = "#EC4899", Type = CategoryType.Expense },
            new Category { UserId = userId, Name = "Entretenimiento", Color = "#8B5CF6", Type = CategoryType.Expense },
            new Category { UserId = userId, Name = "Otros", Color = "#6B7280", Type = CategoryType.Expense },
            new Category { UserId = userId, Name = "Sueldo", Color = "#10B981", Type = CategoryType.Income },
            new Category { UserId = userId, Name = "Regalo", Color = "#F59E0B", Type = CategoryType.Income },
            new Category { UserId = userId, Name = "Reembolso", Color = "#3B82F6", Type = CategoryType.Income },
            new Category { UserId = userId, Name = "Venta", Color = "#8B5CF6", Type = CategoryType.Income },
            new Category { UserId = userId, Name = "Otros ingresos", Color = "#6B7280", Type = CategoryType.Income }
        );
    }
}
