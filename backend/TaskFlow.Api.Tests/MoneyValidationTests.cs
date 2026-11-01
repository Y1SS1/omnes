using TaskFlow.Api.Services;
using Xunit;

namespace TaskFlow.Api.Tests;

public class MoneyValidationTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(100)]
    [InlineData(999_999_999_999)]
    public void IsWithinRange_AcceptsValuesInsideBounds(decimal amount)
    {
        Assert.True(MoneyValidation.IsWithinRange(amount));
    }

    [Theory]
    [InlineData(-0.01)]
    [InlineData(-1000)]
    [InlineData(1_000_000_000_000)]
    public void IsWithinRange_RejectsValuesOutsideBounds(decimal amount)
    {
        Assert.False(MoneyValidation.IsWithinRange(amount));
    }
}
