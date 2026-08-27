using TaskFlow.Api.Models;

namespace TaskFlow.Api.Dtos;

public record WalletDto(decimal Balance, decimal SavingsFund);
public record SetBalanceRequest(decimal Amount);

public record CreateTransactionRequest(decimal Amount, TransactionType Type, Guid? CategoryId, string? Description, DateTime? Date);

public record TransactionDto(
    Guid Id, decimal Amount, TransactionType Type, Guid? CategoryId,
    string? CategoryName, string? CategoryColor, string? Description, DateTime Date
);
