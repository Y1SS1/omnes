using System.Globalization;

namespace TaskFlow.Api.Services;

// Writes amounts the way Chileans read them ("$1.234.567") without depending on
// the server having the es-CL culture installed.
public static class MoneyText
{
    private static readonly NumberFormatInfo ChileanNumbers = new()
    {
        NumberGroupSeparator = ".",
        NumberDecimalSeparator = ",",
        NegativeSign = "-",
    };

    public static string Clp(decimal amount) =>
        "$" + Math.Round(amount, 0, MidpointRounding.AwayFromZero).ToString("#,0", ChileanNumbers);
}
