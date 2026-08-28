namespace TaskFlow.Api.Models;

public enum TaskKind
{
    Task = 0,
    Note = 1,
    DoneActivity = 2
}

public enum DeadlineScope
{
    None = 0,
    Today = 1,
    Week = 2,
    Month = 3
}

public enum CategoryType
{
    Task = 0,
    Expense = 1,
    Income = 2
}

public enum TransactionType
{
    Expense = 0,
    Income = 1
}

[Flags]
public enum DaysOfWeekFlags
{
    None = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 4,
    Thursday = 8,
    Friday = 16,
    Saturday = 32,
    Sunday = 64
}
