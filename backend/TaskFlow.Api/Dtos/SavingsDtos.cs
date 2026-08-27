namespace TaskFlow.Api.Dtos;

// US-17: move money from spendable balance into the untouchable savings fund.
public record AllocateSavingsRequest(decimal Amount, string? Note);

// US-18: monthlyAmount x months -> projected total.
public record ProjectionResult(decimal MonthlyAmount, int Months, decimal ProjectedTotal);

// US-19: targetAmount / months -> required monthly quota.
public record QuotaResult(decimal TargetAmount, int Months, decimal MonthlyQuota);

public record SetSavingsPlanRequest(int Year, int Month, decimal PlannedAmount);

public record SavingsMovementDto(Guid Id, decimal Amount, DateTime Date, string? Note);
