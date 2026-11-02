using System.Security.Claims;
using ClosedXML.Excel;
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

    public static JwtTokenService NewJwtService() => new(new JwtSettings(
        "test-only-key-not-used-in-production-0123456789", "TaskFlowApi.Tests", "TaskFlowClient.Tests"));

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

    public static MemoryStream NewBudgetExcel(params object?[][] rows)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Presupuesto");
        for (var r = 0; r < rows.Length; r++)
        {
            for (var c = 0; c < rows[r].Length; c++)
            {
                sheet.Cell(r + 1, c + 1).Value = rows[r][c] switch
                {
                    null => Blank.Value,
                    string s => s,
                    int i => i,
                    double d => d,
                    var other => throw new ArgumentException($"Unsupported cell value: {other}"),
                };
            }
        }

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }
}
