namespace TaskFlow.Api.Dtos;

// US-17: move money from spendable balance into the untouchable savings fund,
// optionally earmarked for one named goal.
public record AllocateSavingsRequest(decimal Amount, string? Note, Guid? SavingsGoalId);

public record CreateSavingsGoalRequest(string Name, decimal TargetAmount, int TargetMonths);

// US-18/US-19 combined: a named goal already carries target + deadline, so the
// required monthly quota and projected total are just derived from those two.
public record SavingsGoalDto(
    Guid Id,
    string Name,
    decimal TargetAmount,
    int TargetMonths,
    decimal MonthlyQuota,
    decimal SavedAmount,
    DateTime CreatedAt
);

public record SavingsMovementDto(Guid Id, decimal Amount, DateTime Date, string? Note, Guid? SavingsGoalId);
