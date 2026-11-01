using TaskFlow.Api.Models;

namespace TaskFlow.Api.Dtos;

public record CategoryDto(Guid Id, string Name, string Color, CategoryType Type);
public record CreateCategoryRequest(string Name, string Color, CategoryType Type);
