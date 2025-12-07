export async function onRequestPost(context) {
  const { request, env } = context;

  // TODO: Set your backend origin (HTTPS URL)
  const backendOrigin = env.BACKEND_ORIGIN || "https://your-backend.example.com";

  const url = new URL(request.url);
  // Strip the `/api` prefix when forwarding
  const targetUrl = backendOrigin + url.pathname.replace(/^\/api/, "") + url.search;

  // Clone method, headers, and body
  const method = request.method;
  const headers = new Headers(request.headers);
  // Optionally adjust headers (remove CF-specific, keep content-type)
  headers.delete("host");

  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const res = await fetch(targetUrl, {
    method,
    headers,
    body,
  });

  // Pass through response as-is
  const respBody = await res.arrayBuffer();
  const respHeaders = new Headers(res.headers);
  return new Response(respBody, { status: res.status, headers: respHeaders });
}
