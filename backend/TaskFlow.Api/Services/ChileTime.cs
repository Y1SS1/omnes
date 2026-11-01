namespace TaskFlow.Api.Services;

public static class ChileTime
{
    private static readonly TimeZoneInfo Zone = FindZone();

    private static TimeZoneInfo FindZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Santiago");
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            // A host without time zone data should only shift dates by some hours, not break the app.
            return TimeZoneInfo.Utc;
        }
    }

    public static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    // Uses the current offset instead of converting local midnight: Chile changes
    // its clocks at midnight, so that time does not exist on some days and would throw.
    public static DateTime StartOfTodayUtc()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Zone);
        return new DateTimeOffset(now.Date, now.Offset).UtcDateTime;
    }
}
