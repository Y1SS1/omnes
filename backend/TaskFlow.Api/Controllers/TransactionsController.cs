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
[Route("api/transactions")]
public class TransactionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;

    public TransactionsController(AppDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // US-13: history, most recent first.
    [HttpGet]
    public async Task<ActionResult<List<TransactionDto>>> GetAll([FromQuery] int? year, [FromQuery] int? month)
    {
        var query = _db.Transactions.Include(t => t.Category)
            .Where(t => t.UserId == _currentUser.UserId);

        if (year.HasValue && month.HasValue)
        {
            var start = new DateTime(year.Value, month.Value, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddMonths(1);
            query = query.Where(t => t.Date >= start && t.Date < end);
        }

        var items = await query.OrderByDescending(t => t.Date).ToListAsync();
        return items.Select(ToDto).ToList();
    }

    // US-11 / US-12: register a movement and auto-adjust the wallet balance.
    // US-16: also raises a near-limit notification when the monthly spend hits 90% of budget.
    [HttpPost]
    public async Task<ActionResult<TransactionDto>> Create(CreateTransactionRequest req)
    {
        if (req.Amount <= 0) return BadRequest("El monto debe ser mayor a 0.");
        if (!MoneyValidation.IsWithinRange(req.Amount))
            return BadRequest($"El monto es demasiado grande. El máximo permitido es {MoneyValidation.MaxAmount:N0}.");

        var wallet = await _db.Wallets.FirstOrDefaultAsync(w => w.UserId == _currentUser.UserId);
        if (wallet is null) return NotFound("Billetera no encontrada.");

        var date = req.Date ?? DateTime.UtcNow;
        var transaction = new Transaction
        {
            UserId = _currentUser.UserId,
            Amount = req.Amount,
            Type = req.Type,
            CategoryId = req.CategoryId,
            Description = req.Description,
            Date = date
        };
        _db.Transactions.Add(transaction);

        wallet.Balance += req.Type == TransactionType.Income ? req.Amount : -req.Amount;

        if (req.Type == TransactionType.Expense)
        {
            var monthStart = new DateTime(date.Year, date.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var monthEnd = monthStart.AddMonths(1);
            var budget = await _db.Budgets.FirstOrDefaultAsync(b =>
                b.UserId == _currentUser.UserId && b.Month == DateOnly.FromDateTime(monthStart));

            if (budget is not null && budget.LimitAmount > 0)
            {
                var spentBefore = await _db.Transactions
                    .Where(t => t.UserId == _currentUser.UserId && t.Type == TransactionType.Expense
                        && t.Date >= monthStart && t.Date < monthEnd && t.Id != transaction.Id)
                    .SumAsync(t => t.Amount);
                var spentAfter = spentBefore + req.Amount;
                var pctBefore = spentBefore / budget.LimitAmount;
                var pctAfter = spentAfter / budget.LimitAmount;

                if (pctBefore < 0.9m && pctAfter >= 0.9m)
                {
                    _db.Notifications.Add(new Notification
                    {
                        UserId = _currentUser.UserId,
                        Message = "Atención, estás muy cerca de llegar a tu objetivo máximo de gasto este mes"
                    });
                }
            }
        }

        await _db.SaveChangesAsync();
        await _db.Entry(transaction).Reference(t => t.Category).LoadAsync();
        return Ok(ToDto(transaction));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var transaction = await _db.Transactions.FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId);
        if (transaction is null) return NotFound();

        var wallet = await _db.Wallets.FirstAsync(w => w.UserId == _currentUser.UserId);
        wallet.Balance -= transaction.Type == TransactionType.Income ? transaction.Amount : -transaction.Amount;

        _db.Transactions.Remove(transaction);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static TransactionDto ToDto(Transaction t) => new(
        t.Id, t.Amount, t.Type, t.CategoryId, t.Category?.Name, t.Category?.Color, t.Description, t.Date
    );
}
