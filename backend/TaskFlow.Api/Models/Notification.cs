namespace TaskFlow.Api.Models;

// In-app stand-in for US-07's push notification (no APNs/Firebase credentials
// available in this environment - see README for how to wire real push).
public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Message { get; set; } = string.Empty;
    public Guid? RelatedTaskId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
