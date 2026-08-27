using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

public static class DaysOfWeekHelper
{
    public static DaysOfWeekFlags ToFlag(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => DaysOfWeekFlags.Monday,
        DayOfWeek.Tuesday => DaysOfWeekFlags.Tuesday,
        DayOfWeek.Wednesday => DaysOfWeekFlags.Wednesday,
        DayOfWeek.Thursday => DaysOfWeekFlags.Thursday,
        DayOfWeek.Friday => DaysOfWeekFlags.Friday,
        DayOfWeek.Saturday => DaysOfWeekFlags.Saturday,
        DayOfWeek.Sunday => DaysOfWeekFlags.Sunday,
        _ => DaysOfWeekFlags.None
    };

    public static bool IsScheduledOn(DaysOfWeekFlags repeatDays, DateOnly date)
    {
        var flag = ToFlag(date.DayOfWeek);
        return (repeatDays & flag) == flag;
    }
}
