namespace TaskFlow.Api.Dtos;

public record NotificationDto(Guid Id, string Message, bool IsRead, DateTime CreatedAt);
