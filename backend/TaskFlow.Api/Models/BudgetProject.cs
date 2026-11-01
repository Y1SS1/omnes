namespace TaskFlow.Api.Models;

// A business/project budget imported from Excel. Unrelated to Budget, which is
// the user's personal monthly spending limit.
public class BudgetProject
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<BudgetItem> Items { get; set; } = new List<BudgetItem>();

    // How the table and the Excel show the items: assets first, each group from A to Z.
    public IEnumerable<BudgetItem> OrderedItems() => Items
        .OrderBy(i => i.Type)
        .ThenBy(i => i.Name, StringComparer.InvariantCultureIgnoreCase);
}
