namespace TaskFlow.Api.Models;

public class Transaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public decimal Amount { get; set; }
    public TransactionType Type { get; set; } = TransactionType.Expense;
    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }
    public string? Description { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
}
