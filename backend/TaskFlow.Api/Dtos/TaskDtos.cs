using TaskFlow.Api.Models;

namespace TaskFlow.Api.Dtos;

public record CategoryDto(Guid Id, string Name, string Color, CategoryType Type);
public record CreateCategoryRequest(string Name, string Color, CategoryType Type);

public record CreateTaskRequest(
    string Title,
    string? Description,
    TaskKind Kind,
    DeadlineScope DeadlineScope,
    DateTime? DueAt,
    bool IsRepetitive,
    DaysOfWeekFlags RepeatDays,
    Guid? CategoryId
);

public record UpdateTaskRequest(
    string Title,
    string? Description,
    DeadlineScope DeadlineScope,
    DateTime? DueAt,
    bool IsRepetitive,
    DaysOfWeekFlags RepeatDays,
    Guid? CategoryId
);

public record TaskDto(
    Guid Id,
    string Title,
    string? Description,
    TaskKind Kind,
    DeadlineScope DeadlineScope,
    DateTime? DueAt,
    bool IsRepetitive,
    DaysOfWeekFlags RepeatDays,
    bool IsCompleted,
    DateTime? CompletedAt,
    Guid? CategoryId,
    string? CategoryColor,
    string? CategoryName,
    DateTime CreatedAt,
    bool? HabitCheckedToday
);
