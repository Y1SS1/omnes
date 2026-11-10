namespace TaskFlow.Api.Models;

// No longer used: the app dropped in-app notifications (the 90% spending warning
// now lives on the wallet's "Gastado en el mes" card). The table stays so the
// existing migrations and data remain valid.
public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
