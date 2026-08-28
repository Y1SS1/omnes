namespace TaskFlow.Api.Models;

// A named "sinking fund" - e.g. "Cambio de maquinaria" - with its own target
// amount and deadline, so a user can track several savings goals at once.
public class SavingsGoal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Name { get; set; } = string.Empty;
    public decimal TargetAmount { get; set; }
    public int TargetMonths { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SavingsMovement> Movements { get; set; } = new List<SavingsMovement>();
}
