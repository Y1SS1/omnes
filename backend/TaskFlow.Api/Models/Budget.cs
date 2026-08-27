namespace TaskFlow.Api.Models;

public class Budget
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    // First day of the month this budget applies to
    public DateOnly Month { get; set; }
    public decimal LimitAmount { get; set; }
}
