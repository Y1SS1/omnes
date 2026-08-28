using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;

    public TasksController(AppDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // US-01 / US-02: quick capture + deadline classification. Excludes repetitive habits (see /habits).
    [HttpGet]
    public async Task<ActionResult<List<TaskDto>>> GetAll([FromQuery] DeadlineScope? scope, [FromQuery] TaskKind? kind)
    {
        var query = _db.Tasks.Include(t => t.Category)
            .Where(t => t.UserId == _currentUser.UserId && !t.IsRepetitive);

        if (scope.HasValue) query = query.Where(t => t.DeadlineScope == scope.Value);
        if (kind.HasValue) query = query.Where(t => t.Kind == kind.Value);

        var tasks = await query.OrderBy(t => t.DueAt ?? DateTime.MaxValue).ThenByDescending(t => t.CreatedAt).ToListAsync();
        return tasks.Select(t => ToDto(t)).ToList();
    }

    // US-03 / US-04 / US-05: repetitive habits scheduled for a given date, with today's check state.
    // Pass all=true to list every habit regardless of the day (for managing/deleting ones not due today).
    [HttpGet("habits")]
    public async Task<ActionResult<List<TaskDto>>> GetHabits([FromQuery] DateOnly? date, [FromQuery] bool all = false)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var habits = await _db.Tasks.Include(t => t.Category)
            .Where(t => t.UserId == _currentUser.UserId && t.IsRepetitive)
            .ToListAsync();

        var selected = all ? habits : habits.Where(h => DaysOfWeekHelper.IsScheduledOn(h.RepeatDays, targetDate)).ToList();
        var habitIds = selected.Select(h => h.Id).ToList();

        var completions = await _db.HabitCompletions
            .Where(h => habitIds.Contains(h.TaskItemId) && h.Date == targetDate)
            .ToDictionaryAsync(h => h.TaskItemId, h => h.IsChecked);

        return selected
            .OrderBy(h => h.CreatedAt)
            .Select(h => ToDto(h, completions.TryGetValue(h.Id, out var isChecked) && isChecked))
            .ToList();
    }

    // US-08: monthly calendar view - any task/habit occurrence with a concrete date in range.
    [HttpGet("calendar")]
    public async Task<ActionResult<List<TaskDto>>> GetCalendar([FromQuery] int year, [FromQuery] int month)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);
        var startDt = DateTime.SpecifyKind(start.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        var endDt = DateTime.SpecifyKind(end.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

        var dated = await _db.Tasks.Include(t => t.Category)
            .Where(t => t.UserId == _currentUser.UserId && !t.IsRepetitive && t.DueAt != null
                && t.DueAt >= startDt && t.DueAt < endDt)
            .ToListAsync();

        var habits = await _db.Tasks.Include(t => t.Category)
            .Where(t => t.UserId == _currentUser.UserId && t.IsRepetitive)
            .ToListAsync();

        var result = dated.Select(t => ToDto(t)).ToList();

        for (var d = start; d < end; d = d.AddDays(1))
        {
            foreach (var h in habits.Where(h => DaysOfWeekHelper.IsScheduledOn(h.RepeatDays, d)))
            {
                result.Add(ToDto(h) with { DueAt = DateTime.SpecifyKind(d.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc) });
            }
        }

        return result.OrderBy(t => t.DueAt).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<TaskDto>> Create(CreateTaskRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("El título es obligatorio.");

        var task = new TaskItem
        {
            UserId = _currentUser.UserId,
            Title = req.Title,
            Description = req.Description,
            Kind = req.Kind,
            DeadlineScope = req.DeadlineScope,
            DueAt = req.DueAt,
            IsRepetitive = req.IsRepetitive,
            RepeatDays = req.RepeatDays,
            CategoryId = req.CategoryId
        };

        // "Realizado" quick-capture logs something already done, so it's complete on arrival
        // (counts toward the productivity reports right away instead of sitting invisible).
        if (req.Kind == TaskKind.DoneActivity)
        {
            task.IsCompleted = true;
            task.CompletedAt = DateTime.UtcNow;
        }
        _db.Tasks.Add(task);
        await _db.SaveChangesAsync();
        await _db.Entry(task).Reference(t => t.Category).LoadAsync();
        return Ok(ToDto(task));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TaskDto>> Update(Guid id, UpdateTaskRequest req)
    {
        var task = await _db.Tasks.Include(t => t.Category)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId);
        if (task is null) return NotFound();

        task.Title = req.Title;
        task.Description = req.Description;
        task.DeadlineScope = req.DeadlineScope;
        task.DueAt = req.DueAt;
        task.IsRepetitive = req.IsRepetitive;
        task.RepeatDays = req.RepeatDays;
        task.CategoryId = req.CategoryId;
        if (req.DueAt != task.DueAt) task.NotificationSent = false;

        await _db.SaveChangesAsync();
        return Ok(ToDto(task));
    }

    // US-04: check/uncheck a non-repetitive task or "done activity" entry.
    [HttpPost("{id}/complete")]
    public async Task<ActionResult<TaskDto>> ToggleComplete(Guid id)
    {
        var task = await _db.Tasks.Include(t => t.Category)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId && !t.IsRepetitive);
        if (task is null) return NotFound();

        task.IsCompleted = !task.IsCompleted;
        task.CompletedAt = task.IsCompleted ? DateTime.UtcNow : null;
        await _db.SaveChangesAsync();
        return Ok(ToDto(task));
    }

    // US-04 / US-05: check/uncheck a repetitive habit for a specific day (defaults to today).
    [HttpPost("{id}/toggle-habit")]
    public async Task<ActionResult<TaskDto>> ToggleHabit(Guid id, [FromQuery] DateOnly? date)
    {
        var task = await _db.Tasks.Include(t => t.Category)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId && t.IsRepetitive);
        if (task is null) return NotFound();

        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var completion = await _db.HabitCompletions
            .FirstOrDefaultAsync(h => h.TaskItemId == id && h.Date == targetDate);

        if (completion is null)
        {
            completion = new HabitCompletion { TaskItemId = id, Date = targetDate, IsChecked = true, CheckedAt = DateTime.UtcNow };
            _db.HabitCompletions.Add(completion);
        }
        else
        {
            completion.IsChecked = !completion.IsChecked;
            completion.CheckedAt = completion.IsChecked ? DateTime.UtcNow : null;
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(task, completion.IsChecked));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId);
        if (task is null) return NotFound();
        _db.Tasks.Remove(task);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static TaskDto ToDto(TaskItem t, bool? habitCheckedToday = null) => new(
        t.Id, t.Title, t.Description, t.Kind, t.DeadlineScope, t.DueAt,
        t.IsRepetitive, t.RepeatDays, t.IsCompleted, t.CompletedAt,
        t.CategoryId, t.Category?.Color, t.Category?.Name, t.CreatedAt, habitCheckedToday
    );
}
