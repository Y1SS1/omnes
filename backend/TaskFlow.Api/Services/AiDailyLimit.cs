using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Models;

namespace TaskFlow.Api.Services;

// Daily cap on one kind of AI call per user. Every call spends AI credit, so the attempt counts
// even if the AI then fails.
public static class AiDailyLimit
{
    // Record first, count after: a request always counts its own row and every row saved before
    // it, so simultaneous requests can never let more than the limit through (at worst two racing
    // for the last slot are both turned away, never both let in). Returns how many uses are left
    // today, or null when the limit was already reached (and nothing stays recorded).
    public static async Task<int?> TryUseAsync(
        AppDbContext db, Guid userId, string kind, int maxPerDay, CancellationToken cancellationToken)
    {
        var usage = new AiUsage { UserId = userId, Kind = kind };
        db.AiUsages.Add(usage);
        await db.SaveChangesAsync(cancellationToken);

        var usedToday = await db.AiUsages.CountAsync(u =>
            u.UserId == userId && u.Kind == kind && u.CreatedAt >= ChileTime.StartOfTodayUtc(), cancellationToken);
        if (usedToday <= maxPerDay) return maxPerDay - usedToday;

        db.AiUsages.Remove(usage);
        await db.SaveChangesAsync(CancellationToken.None);
        return null;
    }
}
