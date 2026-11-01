namespace TaskFlow.Api.Models;

public class BudgetItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BudgetProjectId { get; set; }
    public BudgetProject? BudgetProject { get; set; }
    public string Name { get; set; } = string.Empty;
    public BudgetItemType Type { get; set; }
    public string Category { get; set; } = string.Empty;
    public decimal EstimatedAmount { get; set; }

    // Plain-text AI answer (price range + suggested suppliers); null until quoted.
    public string? AiQuoteSummary { get; set; }
    public DateTime? AiQuotedAt { get; set; }
}
