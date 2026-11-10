namespace TaskFlow.Api.Models;

// One AI call a user made, kept to enforce daily limits that survive app restarts.
public class AiUsage
{
    public const string BudgetDraft = "budget-draft";

    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Kind { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
