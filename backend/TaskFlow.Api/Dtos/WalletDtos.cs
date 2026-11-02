using System.Text.Json.Serialization;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Dtos;

public record WalletDto(decimal Balance, decimal SavingsFund);
public record SetBalanceRequest([property: JsonRequired] decimal Amount);

public record CreateTransactionRequest([property: JsonRequired] decimal Amount, [property: JsonRequired] TransactionType Type, Guid? CategoryId, string? Description, DateTime? Date);

public record TransactionDto(
    Guid Id, decimal Amount, TransactionType Type, Guid? CategoryId,
    string? CategoryName, string? CategoryColor, string? Description, DateTime Date
);
