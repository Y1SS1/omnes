using TaskFlow.Api.Services;

namespace TaskFlow.Api.Tests;

public class MoneyTextTests
{
    [Theory]
    [InlineData(0, "$0")]
    [InlineData(950, "$950")]
    [InlineData(320000, "$320.000")]
    [InlineData(1234567.6, "$1.234.568")]
    [InlineData(-180000, "$-180.000")]
    public void Clp_UsesDotsAsThousandsSeparator(double amount, string expected)
    {
        Assert.Equal(expected, MoneyText.Clp((decimal)amount));
    }
}
