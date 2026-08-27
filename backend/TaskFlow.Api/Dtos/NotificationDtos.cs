namespace TaskFlow.Api.Dtos;

public record NotificationDto(Guid Id, string Message, Guid? RelatedTaskId, bool IsRead, DateTime CreatedAt);
