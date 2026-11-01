namespace TaskFlow.Api.Dtos;

public record RegisterRequest(string Email, string Password, string DisplayName);
public record RegisterWorkerRequest(string FirstName, string LastName, string Password);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, Guid UserId, string Email, string DisplayName, string Role, string? JobTitle);
public record WorkerDto(Guid Id, string Email, string DisplayName, string? JobTitle, DateTime CreatedAt);
public record UpdateWorkerRequest(string DisplayName, string Email, string? JobTitle);
