namespace TaskFlow.Api.Services;

public static class MoneyValidation
{
    // Amount columns are numeric(14,2) - 12 integer digits + 2 decimals.
    public const decimal MaxAmount = 999_999_999_999m;

    public static bool IsWithinRange(decimal amount) => amount >= 0 && amount <= MaxAmount;
}
