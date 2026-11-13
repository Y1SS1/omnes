using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TaskFlow.Api.Data;
using TaskFlow.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
});

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddHttpClient<FoundryResponsesClient>();
builder.Services.AddScoped<IBudgetItemClassifier, FoundryBudgetItemClassifier>();
builder.Services.AddScoped<IBudgetItemQuoter, FoundryBudgetItemQuoter>();
builder.Services.AddScoped<IBudgetDrafter, FoundryBudgetDrafter>();
builder.Services.AddScoped<IBudgetReviewer, FoundryBudgetReviewer>();

var jwtSection = builder.Configuration.GetSection("Jwt");
// Checked here because the JWT options below only run on the first authenticated request.
var jwtKey = jwtSection["Key"] ?? throw new InvalidOperationException(
    "Falta Jwt:Key. En desarrollo configurala con 'dotnet user-secrets'; en produccion, como Jwt__Key.");
builder.Services.AddSingleton(new JwtSettings(jwtKey, jwtSection["Issuer"], jwtSection["Audience"]));
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSection["Issuer"],
        ValidAudience = jwtSection["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"])
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    // Covers the case where this account was created before the Admin role
    // existed, or before AppConstants.AdminEmail changed - registering fresh
    // already assigns it correctly.
    var adminUser = await db.Users.FirstOrDefaultAsync(u => u.Email == TaskFlow.Api.AppConstants.AdminEmail);
    if (adminUser is not null && adminUser.Role != TaskFlow.Api.Models.UserRole.Admin)
    {
        adminUser.Role = TaskFlow.Api.Models.UserRole.Admin;
        await db.SaveChangesAsync();
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

// OWASP Recommended Security Headers
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Swagger UI, which only runs in development, needs more than the React app allows.
    if (!app.Environment.IsDevelopment())
    {
        context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");
    }
    await next();
});

// Never leak raw exception/stack-trace text to the client - log it server-side
// and hand back a short, user-facing message instead.
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var feature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
        if (feature?.Error is not null)
        {
            var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogError(feature.Error, "Unhandled exception on {Path}", feature.Path);
        }
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync("\"Ocurrió un error inesperado en el servidor. Intenta de nuevo.\"");
    });
});

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Serve the built React app (wwwroot) from the same host as the API, so the
// whole product lives behind a single Azure URL with no cross-origin setup.
// index.html must be re-checked on every visit so a new deploy shows up right away;
// the files in /assets have a hash in their name, so they can be cached for good.
var spaFiles = new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;
        if (ctx.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase))
        {
            headers.CacheControl = "no-cache";
        }
        else if (ctx.Context.Request.Path.StartsWithSegments("/assets"))
        {
            headers.CacheControl = "public, max-age=31536000, immutable";
        }
    },
};
app.UseDefaultFiles();
app.UseStaticFiles(spaFiles);
app.MapFallbackToFile("index.html", spaFiles);

await app.RunAsync();
