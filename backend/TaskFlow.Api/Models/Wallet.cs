namespace TaskFlow.Api.Models;

public class Wallet
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public decimal Balance { get; set; }

    // US-17: separate "untouchable" savings fund, kept apart from spendable balance
    public decimal SavingsFund { get; set; }
}
