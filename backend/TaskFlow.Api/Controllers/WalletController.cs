using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Api.Data;
using TaskFlow.Api.Dtos;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/wallet")]
public class WalletController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUserService _currentUser;

    public WalletController(AppDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<WalletDto>> Get()
    {
        var wallet = await _db.Wallets.FirstOrDefaultAsync(w => w.UserId == _currentUser.UserId);
        if (wallet is null) return NotFound();
        return Ok(new WalletDto(wallet.Balance, wallet.SavingsFund));
    }

    // US-10: initial/reset balance for the wallet.
    [HttpPost("balance")]
    public async Task<ActionResult<WalletDto>> SetBalance(SetBalanceRequest req)
    {
        var wallet = await _db.Wallets.FirstOrDefaultAsync(w => w.UserId == _currentUser.UserId);
        if (wallet is null) return NotFound();
        wallet.Balance = req.Amount;
        await _db.SaveChangesAsync();
        return Ok(new WalletDto(wallet.Balance, wallet.SavingsFund));
    }
}
