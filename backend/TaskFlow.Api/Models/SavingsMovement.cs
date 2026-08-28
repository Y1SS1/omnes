namespace TaskFlow.Api.Models;

// US-17: money actually moved into the untouchable savings fund
public class SavingsMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public decimal Amount { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }

    // Which named goal this money was set aside for (null = not tied to a goal).
    public Guid? SavingsGoalId { get; set; }
    public SavingsGoal? SavingsGoal { get; set; }
}
