using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Extensions.Logging.Abstractions;
using HtmxEcommerceRazorComponents.Components.Fragments;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents();
builder.Services.AddHttpClient();

var app = builder.Build();

app.UseStaticFiles();
app.UseAntiforgery();

// HTMX endpoint: Returns HTML fragment for product list using Razor Component
app.MapGet("/api/products", async (IHttpClientFactory factory, HttpContext context) =>
{
    var http = factory.CreateClient();
    var response = await http.GetFromJsonAsync<ProductResponse>("https://dummyjson.com/products");

    if (response == null || response.Products == null)
    {
        return Results.Content("<p>Error loading products</p>", "text/html");
    }

    // Render Razor Component to HTML string
    var html = await RenderComponentAsync<ProductList>(
        new Dictionary<string, object?> { { "Products", response.Products } }
    );

    return Results.Content(html, "text/html");
});

// HTMX endpoint: Returns HTML fragment for product detail using Razor Component
app.MapGet("/api/product/{id:int}", async (int id, IHttpClientFactory factory) =>
{
    var http = factory.CreateClient();
    var product = await http.GetFromJsonAsync<Product>($"https://dummyjson.com/products/{id}");

    if (product == null)
    {
        return Results.Content("<p>Product not found</p>", "text/html");
    }

    // Render Razor Component to HTML string
    var html = await RenderComponentAsync<ProductDetailFragment>(
        new Dictionary<string, object?> { { "Product", product } }
    );

    return Results.Content(html, "text/html");
});

// HTMX endpoint: Returns HTML fragment for cart using Razor Component
app.MapGet("/api/cart", async () =>
{
    var html = await RenderComponentAsync<Cart>(new Dictionary<string, object?>());
    return Results.Content(html, "text/html");
});

// Razor Components for initial page loads (SEO-friendly)
app.MapRazorComponents<HtmxEcommerceRazorComponents.App>();

app.Run();

// Helper method to render Razor Components to HTML string
static async Task<string> RenderComponentAsync<TComponent>(Dictionary<string, object?> parameters) where TComponent : IComponent
{
    await using var htmlRenderer = new HtmlRenderer(new ServiceCollection().BuildServiceProvider(), NullLoggerFactory.Instance);
    var html = await htmlRenderer.Dispatcher.InvokeAsync(async () =>
    {
        var parameterView = ParameterView.FromDictionary(parameters);
        var output = await htmlRenderer.RenderComponentAsync<TComponent>(parameterView);
        return output.ToHtmlString();
    });
    return html;
}

// Models for DummyJSON API
public class ProductResponse
{
    public List<Product> Products { get; set; } = new();
    public int Total { get; set; }
    public int Skip { get; set; }
    public int Limit { get; set; }
}

public class Product
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public double DiscountPercentage { get; set; }
    public double Rating { get; set; }
    public int Stock { get; set; }
    public string Brand { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Thumbnail { get; set; } = string.Empty;
    public List<string> Images { get; set; } = new();
}