namespace TaskFlow.Api.Models;

// One row per (habit, calendar day) - lets repetitive habits reset daily (US-04/US-05)
// while retaining full history for the productivity reports (Epic 3).
public class HabitCompletion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskItemId { get; set; }
    public TaskItem? TaskItem { get; set; }
    public DateOnly Date { get; set; }
    public bool IsChecked { get; set; }
    public DateTime? CheckedAt { get; set; }
}
