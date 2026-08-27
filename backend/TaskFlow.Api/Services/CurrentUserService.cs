using System.Security.Claims;

namespace TaskFlow.Api.Services;

public class CurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid UserId
    {
        get
        {
            var sub = _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? _httpContextAccessor.HttpContext?.User?.FindFirstValue("sub");
            if (sub is null || !Guid.TryParse(sub, out var id))
                throw new UnauthorizedAccessException("No authenticated user in context.");
            return id;
        }
    }
}
