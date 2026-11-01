using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using TaskFlow.Api.Models;
using TaskFlow.Api.Services;
using Xunit;

namespace TaskFlow.Api.Tests;

public class FoundryBudgetItemClassifierTests
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
        public string? ApiKeyHeader { get; private set; }
        public Uri? RequestUri { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestUri = request.RequestUri;
            RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            ApiKeyHeader = request.Headers.TryGetValues("api-key", out var values) ? string.Join(",", values) : null;
            return new HttpResponseMessage(_status) { Content = new StringContent(_body, Encoding.UTF8, "application/json") };
        }
    }

    private const string ValidAnswer = """{"items":[{"index":0,"type":"Asset"},{"index":1,"type":"Liability"}]}""";

    // Same shape as the real answer: a reasoning item comes before the message.
    private static string ApiResponse(string status, string text) => JsonSerializer.Serialize(new
    {
        id = "resp_test",
        status,
        output = new object[]
        {
            new { type = "reasoning", summary = Array.Empty<object>() },
            new { type = "message", role = "assistant", content = new[] { new { type = "output_text", text } } },
        },
    });

    private static IConfiguration Config(string? apiKey = "test-key") => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Foundry:Endpoint"] = "https://example.openai.azure.com/",
            ["Foundry:Model"] = "test-model",
            ["Foundry:ApiKey"] = apiKey,
        })
        .Build();

    private static FoundryBudgetItemClassifier NewClassifier(FakeFoundryApi api, string? apiKey = "test-key") =>
        new(new FoundryResponsesClient(new HttpClient(api), Config(apiKey), NullLogger<FoundryResponsesClient>.Instance));

    private static readonly BudgetItemToClassify[] Items =
    [
        new("Carne", "Insumos"),
        new("Arriendo local", "Arriendo"),
    ];

    [Fact]
    public async Task ClassifyAsync_SendsStructuredRequestAndReturnsTypes()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse("completed", ValidAnswer));

        var types = await NewClassifier(api).ClassifyAsync(Items);

        Assert.Equal(new[] { BudgetItemType.Asset, BudgetItemType.Liability }, types);
        Assert.Equal("https://example.openai.azure.com/openai/v1/responses", api.RequestUri!.ToString());
        Assert.Equal("test-key", api.ApiKeyHeader);

        using var request = JsonDocument.Parse(api.RequestBody!);
        var root = request.RootElement;
        Assert.Equal("test-model", root.GetProperty("model").GetString());
        Assert.Equal("json_schema", root.GetProperty("text").GetProperty("format").GetProperty("type").GetString());
        Assert.True(root.GetProperty("text").GetProperty("format").GetProperty("strict").GetBoolean());
        Assert.Contains("Asset", root.GetProperty("instructions").GetString());

        var input = root.GetProperty("input").GetString()!;
        Assert.Contains("Carne", input);
        Assert.Contains("\"index\":1", input);
    }

    [Fact]
    public async Task ClassifyAsync_WhenAnswerIsTruncated_Throws()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse("incomplete", ValidAnswer));

        await Assert.ThrowsAsync<BudgetClassificationException>(() => NewClassifier(api).ClassifyAsync(Items));
    }

    [Fact]
    public async Task ClassifyAsync_WhenModelRefuses_Throws()
    {
        const string refusal = """
            {"status":"completed","output":[{"type":"message","content":[{"type":"refusal","refusal":"No puedo"}]}]}
            """;
        var api = new FakeFoundryApi(HttpStatusCode.OK, refusal);

        await Assert.ThrowsAsync<BudgetClassificationException>(() => NewClassifier(api).ClassifyAsync(Items));
    }

    [Fact]
    public async Task ClassifyAsync_WhenApiFails_ThrowsWithoutProviderDetails()
    {
        var api = new FakeFoundryApi(HttpStatusCode.Unauthorized, """{"error":{"message":"invalid api-key"}}""");

        var ex = await Assert.ThrowsAsync<BudgetClassificationException>(() => NewClassifier(api).ClassifyAsync(Items));

        Assert.DoesNotContain("api-key", ex.Message);
    }

    [Fact]
    public async Task ClassifyAsync_WhenBodyIsNotJson_Throws()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, "<html>Bad gateway</html>");

        await Assert.ThrowsAsync<BudgetClassificationException>(() => NewClassifier(api).ClassifyAsync(Items));
    }

    [Fact]
    public void ParseResponse_ReordersResultsByIndex()
    {
        const string json = """{"items":[{"index":1,"type":"Liability"},{"index":0,"type":"Asset"}]}""";

        var types = FoundryBudgetItemClassifier.ParseResponse(json, 2);

        Assert.Equal(new[] { BudgetItemType.Asset, BudgetItemType.Liability }, types);
    }

    [Theory]
    [InlineData("""{"items":[{"index":0,"type":"Asset"}]}""")]                                  // one result missing
    [InlineData("""{"items":[{"index":0,"type":"Asset"},{"index":0,"type":"Asset"}]}""")]       // repeated index
    [InlineData("""{"items":[{"index":0,"type":"Asset"},{"index":2,"type":"Asset"}]}""")]       // index out of range
    [InlineData("""{"items":[{"index":0,"type":"Asset"},{"index":1,"type":"Otro"}]}""")]        // unknown type
    [InlineData("""{"items":[{"index":0,"type":"Asset"},{"index":1,"type":7}]}""")]             // numeric type
    [InlineData("""{"items":[{"index":0,"type":"Asset"},{"index":1}]}""")]                      // type missing
    [InlineData("""{"resultado":[]}""")]                                                        // wrong shape
    [InlineData("no es json")]
    [InlineData("")]
    public void ParseResponse_WithUntrustworthyAnswer_Throws(string json)
    {
        Assert.Throws<BudgetClassificationException>(() => FoundryBudgetItemClassifier.ParseResponse(json, 2));
    }

    [Fact]
    public async Task ClassifyAsync_WithoutApiKey_ThrowsWithoutCallingTheApi()
    {
        var api = new FakeFoundryApi(HttpStatusCode.OK, ApiResponse("completed", ValidAnswer));

        var ex = await Assert.ThrowsAsync<BudgetClassificationException>(() =>
            NewClassifier(api, apiKey: null).ClassifyAsync(Items));

        Assert.Contains("no está configurada", ex.Message);
        Assert.Null(api.RequestUri);
    }
}
