using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

// US-06/US-07: polls for reminders whose exact due time has arrived and raises an
// in-app notification with the "No olvides hacer: X a las HH:mm horas" format.
// A real iOS push would additionally forward this event to APNs/Firebase - out of
// scope here since no push credentials are available in this environment.
public class ReminderNotificationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReminderNotificationService> _logger;

    public ReminderNotificationService(IServiceScopeFactory scopeFactory, ILogger<ReminderNotificationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckDueRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking due reminders");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task CheckDueRemindersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var due = await db.Tasks
            .Where(t => !t.NotificationSent && t.DueAt != null && t.DueAt <= now)
            .ToListAsync(ct);

        foreach (var task in due)
        {
            var hhmm = task.DueAt!.Value.ToString("HH:mm");
            db.Notifications.Add(new Notification
            {
                UserId = task.UserId,
                RelatedTaskId = task.Id,
                Message = $"No olvides hacer: {task.Title} a las {hhmm} horas"
            });
            task.NotificationSent = true;
        }

        if (due.Count > 0) await db.SaveChangesAsync(ct);
    }
}
