namespace TaskFlow.Api.Models;

public class TaskItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TaskKind Kind { get; set; } = TaskKind.Task;
    public DeadlineScope DeadlineScope { get; set; } = DeadlineScope.None;

    // US-06: specific reminder date/time
    public DateTime? DueAt { get; set; }
    public bool NotificationSent { get; set; }

    // US-03/04/05: repetitive habits
    public bool IsRepetitive { get; set; }
    public DaysOfWeekFlags RepeatDays { get; set; } = DaysOfWeekFlags.None;

    // Non-repetitive completion state (for Task/DoneActivity)
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }

    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<HabitCompletion> HabitCompletions { get; set; } = new List<HabitCompletion>();
}
