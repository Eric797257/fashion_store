/**
 * Only allows redirects to a path on this same site.
 * Blocks "https://evil.com", "//evil.com", "/\evil.com" and similar tricks.
 */
export function safeRedirectPath(
    input: string | null | undefined,
    fallback = "/account",
): string {
    if (!input) return fallback;
    if (!input.startsWith("/") || input.startsWith("/") || input.includes("\\")) return fallback;
    if ([...input].some((ch) => ch.charCodeAt(0) < 32)) return fallback;

    try {
        const url = new URL(input, "http://localhost");
        if (url.origin !== "http://localhost") return fallback;
        return url.pathname + url.search + url.hash;
    } catch {
        return fallback;
    }
}