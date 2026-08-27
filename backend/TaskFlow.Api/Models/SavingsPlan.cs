namespace TaskFlow.Api.Models;

// US-24: the "planned" goal for a given month, compared against real SavingsMovements
public class SavingsPlan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public DateOnly Month { get; set; }
    public decimal PlannedAmount { get; set; }
}
