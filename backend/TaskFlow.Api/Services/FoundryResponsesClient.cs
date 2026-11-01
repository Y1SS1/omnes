using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TaskFlow.Api.Services;

public class FoundryRequestException : Exception
{
    public FoundryRequestException(string message, Exception? innerException = null) : base(message, innerException) { }
}

// Calls the Responses API of a Microsoft Foundry GPT deployment.
public class FoundryResponsesClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly HttpClient _httpClient;
    private readonly ILogger<FoundryResponsesClient> _logger;
    private readonly string? _endpoint;
    private readonly string? _apiKey;

    public FoundryResponsesClient(HttpClient httpClient, IConfiguration configuration, ILogger<FoundryResponsesClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _endpoint = configuration["Foundry:Endpoint"];
        _apiKey = configuration["Foundry:ApiKey"];
        Model = configuration["Foundry:Model"];
    }

    public string? Model { get; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_endpoint) && !string.IsNullOrWhiteSpace(_apiKey) && !string.IsNullOrWhiteSpace(Model);

    // Provider details only go to the log: callers show their own message to the user.
    public async Task<FoundryResponse> SendAsync(object body, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_endpoint!.TrimEnd('/')}/openai/v1/responses")
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Add("api-key", _apiKey);

        FoundryResponse? response;
        try
        {
            using var httpResponse = await _httpClient.SendAsync(request, cancellationToken);
            if (!httpResponse.IsSuccessStatusCode)
            {
                _logger.LogError("Foundry returned HTTP {StatusCode}", (int)httpResponse.StatusCode);
                throw new FoundryRequestException($"Foundry returned HTTP {(int)httpResponse.StatusCode}");
            }
            response = await httpResponse.Content.ReadFromJsonAsync<FoundryResponse>(JsonOptions, cancellationToken);
        }
        catch (Exception ex) when (ex is not FoundryRequestException
            && (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested))
        {
            _logger.LogError(ex, "Foundry request failed");
            throw new FoundryRequestException("Foundry request failed", ex);
        }

        // Truncated answers arrive as HTTP 200, so check before anyone reads them.
        if (response?.Status != "completed")
        {
            _logger.LogError("Foundry response ended with status {Status}, reason {Reason}",
                response?.Status, response?.IncompleteDetails?.Reason);
            throw new FoundryRequestException($"Foundry response ended with status {response?.Status}");
        }
        return response;
    }
}

public record FoundryResponse(
    string? Status,
    List<FoundryOutputItem>? Output,
    [property: JsonPropertyName("tool_usage")] FoundryToolUsage? ToolUsage,
    [property: JsonPropertyName("incomplete_details")] FoundryIncompleteDetails? IncompleteDetails = null)
{
    public string OutputText() => string.Concat((Output ?? [])
        .Where(o => o.Type == "message")
        .SelectMany(o => o.Content ?? [])
        .Where(c => c.Type == "output_text")
        .Select(c => c.Text));

    public IEnumerable<string> WebSourceUrls() => (Output ?? [])
        .Where(o => o.Type == "web_search_call")
        .SelectMany(o => o.Action?.Sources ?? [])
        .Select(s => s.Url)
        .OfType<string>();
}

public record FoundryIncompleteDetails(string? Reason);

public record FoundryOutputItem(string? Type, List<FoundryContentPart>? Content, FoundryWebSearchAction? Action);

public record FoundryContentPart(string? Type, string? Text);

public record FoundryWebSearchAction(List<FoundryWebSource>? Sources);

public record FoundryWebSource(string? Url);

public record FoundryToolUsage([property: JsonPropertyName("web_search")] FoundryWebSearchUsage? WebSearch);

public record FoundryWebSearchUsage([property: JsonPropertyName("num_requests")] int NumRequests);
