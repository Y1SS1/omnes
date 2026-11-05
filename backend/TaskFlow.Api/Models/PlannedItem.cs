namespace TaskFlow.Api.Models;

// A budget line copied from an imported Excel into the wallet's "Presupuesto planificado".
// It is the user's own editable copy: changing it never touches the original budget project,
// and it does not move the wallet balance (it is planned, not spent).
public class PlannedItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid BudgetProjectId { get; set; }
    public BudgetProject? BudgetProject { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public BudgetItemType Type { get; set; }
    public decimal Amount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
