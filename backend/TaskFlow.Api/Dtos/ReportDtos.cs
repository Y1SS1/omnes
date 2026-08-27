namespace TaskFlow.Api.Dtos;

// US-21: habit completion for the month.
public record HabitCompletionReportItem(string HabitTitle, int DaysScheduled, int DaysCompleted, decimal SuccessPercent);

// US-22: tasks/activities completed per day.
public record ProductivityPoint(DateOnly Date, int CompletedCount);

// US-23: completed tasks by category color.
public record TaskCategorySlice(string CategoryName, string Color, int Count, decimal Percent);

// US-24: planned vs real savings for the month.
public record SavingsComparisonDto(decimal Planned, decimal Real);

// US-25: expenses by category for the month.
public record ExpenseCategorySlice(string CategoryName, string Color, decimal Amount, decimal Percent);
