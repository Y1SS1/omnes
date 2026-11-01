using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TaskFlow.Api.Data;
using TaskFlow.Api.Services;

namespace TaskFlow.Api.Tests;

public static class TestHelpers
{
    public static AppDbContext NewDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    public static JwtTokenService NewJwtService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "test-only-key-not-used-in-production-0123456789",
                ["Jwt:Issuer"] = "TaskFlowApi.Tests",
                ["Jwt:Audience"] = "TaskFlowClient.Tests",
            })
            .Build();
        return new JwtTokenService(config);
    }

    public static CurrentUserService NewCurrentUser(Guid userId)
    {
        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "TestAuth")),
        };
        var accessor = new HttpContextAccessor { HttpContext = httpContext };
        return new CurrentUserService(accessor);
    }
}
