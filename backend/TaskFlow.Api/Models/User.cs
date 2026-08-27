namespace TaskFlow.Api.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Wallet? Wallet { get; set; }
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    public ICollection<Budget> Budgets { get; set; } = new List<Budget>();
    public ICollection<SavingsMovement> SavingsMovements { get; set; } = new List<SavingsMovement>();
    public ICollection<SavingsPlan> SavingsPlans { get; set; } = new List<SavingsPlan>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}
