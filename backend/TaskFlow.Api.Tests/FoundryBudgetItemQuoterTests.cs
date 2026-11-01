using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using TaskFlow.Api.Services;
using Xunit;

namespace TaskFlow.Api.Tests;

public class FoundryBudgetItemQuoterTests
{
    private sealed class FakeFoundryApi : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _body;

        public FakeFoundryApi(HttpStatusCode status, string body)
        {
            _status = status;
            _body = body;
        }

        public string? RequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(_status) { Content = new StringContent(_body, Encoding.UTF8, "application/json") };
        }
    }

    private const string ValidAnswer = """
        {"price_range":"$5.000 - $9.000 CLP por kg","best_value":"Marca X","suppliers":["Lider","Mayorista 10"]}
        """;

    private const string ValidSummary =
        "Rango: $5.000 - $9.000 CLP por kg. Mejor precio-calidad: Marca X. Proveedores sugeridos: Lider, Mayorista 10.";

    // Same shape as the real answer: reasoning, then the search with its sources, then the message.
    private static string ApiResponse(string text, int searches = 3, string status = "completed", params string[] sources) => JsonSerializer.Serialize(new
    {
        status,
        output = new object[]
        {
            new { type = "reasoning", summary = Array.Empty<object>() },
            new { type = "web_search_call", action = new { type = "search", sources = sources.Select(url => new { type = "url", url }) } },
            new { type = "message", role = "assistant", content = new[] { new { type = "output_text", text } } },
        },
        tool_usage = new { web_search = new { num_requests = searches } },
    });

    private static FoundryBudgetItemQuoter NewQuoter(FakeFoundryApi api, string? apiKey = "test-key")
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Foundry:Endpoint"] = "https://example.openai.azure.com",
            ["Foundry:Model"] = "test-model",
            ["Foundry:ApiKey"] = apiKey,
        }).Build();
        var client = new FoundryResponsesClient(new HttpClient(api), config, NullLogger<FoundryResponsesClient>.Instance);
        return new FoundryBudgetItemQuoter(client, NullLogger<FoundryBudgetItemQuoter>.Instance);
    }

    [Fact]
    public async Task QuoteAsync_ForcesASearchAndAsksForTheThreeBlocks()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse(ValidAnswer));

        await NewQuoter(api).QuoteAsync("Carne de vacuno", "Insumos");

        using var request = JsonDocument.Parse(api.RequestBody!);
        var root = request.RootElement;
        Assert.Equal("test-model", root.GetProperty("model").GetString());
        Assert.Equal("web_search", root.GetProperty("tools")[0].GetProperty("type").GetString());
        Assert.Equal("required", root.GetProperty("tool_choice").GetString());
        Assert.Equal("web_search_call.action.sources", root.GetProperty("include")[0].GetString());
        Assert.Contains("'Carne de vacuno' (categoría: Insumos)", root.GetProperty("input").GetString());
        Assert.Contains("mejor relación precio-calidad", root.GetProperty("input").GetString());

        var format = root.GetProperty("text").GetProperty("format");
        Assert.Equal("json_schema", format.GetProperty("type").GetString());
        Assert.True(format.GetProperty("strict").GetBoolean());
        var required = format.GetProperty("schema").GetProperty("required").EnumerateArray().Select(e => e.GetString());
        Assert.Equal(["price_range", "best_value", "suppliers"], required);
    }

    [Fact]
    public async Task QuoteAsync_WritesBlocksAndSourcesWithFixedLabels()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse(ValidAnswer, sources: ["https://www.lider.cl/carne", "https://www.odepa.gob.cl/precios"]));

        var quote = await NewQuoter(api).QuoteAsync("Carne", "Insumos");

        Assert.Equal($"{ValidSummary} Fuentes consultadas: odepa.gob.cl, lider.cl.", quote);
    }

    [Fact]
    public async Task QuoteAsync_WithoutSources_ReturnsJustTheBlocks()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse(ValidAnswer));

        Assert.Equal(ValidSummary, await NewQuoter(api).QuoteAsync("Carne", "Insumos"));
    }

    [Fact]
    public async Task QuoteAsync_WhenNoSearchHappened_Throws()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse(ValidAnswer, searches: 0));

        await Assert.ThrowsAsync<BudgetQuoteException>(() => NewQuoter(api).QuoteAsync("Carne", "Insumos"));
    }

    [Theory]
    [InlineData("No encontré precios para ese producto.")]
    [InlineData("")]
    [InlineData("""{"price_range":"$1 - $2 CLP","best_value":"Marca"}""")]
    [InlineData("""{"price_range":"","best_value":"Marca","suppliers":["Lider"]}""")]
    [InlineData("""{"price_range":"$1 - $2 CLP","best_value":"  ","suppliers":["Lider"]}""")]
    [InlineData("""{"price_range":"$1 - $2 CLP","best_value":"Marca","suppliers":[]}""")]
    public async Task QuoteAsync_WhenFormatIsWrong_Throws(string answer)
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse(answer));

        await Assert.ThrowsAsync<BudgetQuoteException>(() => NewQuoter(api).QuoteAsync("Carne", "Insumos"));
    }

    [Fact]
    public async Task QuoteAsync_WhenAnswerIsTruncated_Throws()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse(ValidAnswer, status: "incomplete"));

        await Assert.ThrowsAsync<BudgetQuoteException>(() => NewQuoter(api).QuoteAsync("Carne", "Insumos"));
    }

    [Fact]
    public async Task QuoteAsync_WhenApiFails_ThrowsWithoutProviderDetails()
    {
        var api = new FakeFoundryApi(HttpStatusCode.TooManyRequests, """{"error":{"message":"quota exceeded"}}""");

        var ex = await Assert.ThrowsAsync<BudgetQuoteException>(() => NewQuoter(api).QuoteAsync("Carne", "Insumos"));

        Assert.DoesNotContain("quota", ex.Message);
    }

    [Fact]
    public async Task QuoteAsync_WithoutApiKey_ThrowsWithoutCallingTheApi()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse(ValidAnswer));

        var ex = await Assert.ThrowsAsync<BudgetQuoteException>(() => NewQuoter(api, apiKey: null).QuoteAsync("Carne", "Insumos"));

        Assert.Contains("no está configurada", ex.Message);
        Assert.Null(api.RequestBody);
    }

    [Theory]
    [InlineData("$1 - $2 CLP. ([agroprice.cl](https://www.agroprice.cl/precio/papa))", "$1 - $2 CLP")]
    [InlineData("La Vega\n([sodimac.cl](https://sodimac.cl/x)) y Lider.", "La Vega y Lider")]
    [InlineData("Lider https://lider.cl/carne", "Lider")]
    [InlineData(null, "")]
    public void CleanField_RemovesLinksExtraSpacesAndFinalPeriod(string? text, string expected)
    {
        Assert.Equal(expected, FoundryBudgetItemQuoter.CleanField(text));
    }

    [Fact]
    public void PickSources_PrefersChileanSitesRemovesRepeatsAndKeepsFive()
    {
        var sources = FoundryBudgetItemQuoter.PickSources(
        [
            "https://indexmundi.com/a",
            "https://www.lider.cl/a",
            "https://lider.cl/b",
            "no es una url",
            "https://datos.odepa.gob.cl/c",
            "https://elmostrador.cl/d",
            "https://aprocarne.cl/e",
            "https://tottus.cl/f",
            "https://glassdoor.es/g",
        ]);

        Assert.Equal(["datos.odepa.gob.cl", "lider.cl", "elmostrador.cl", "aprocarne.cl", "tottus.cl"], sources);
    }
}
