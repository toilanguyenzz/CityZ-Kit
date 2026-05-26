export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const targetUrl = url.trim();
    // Fetch with redirect: 'manual' to intercept the 301/302 redirect URL
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'manual',
    });

    const location = res.headers.get('location');
    if (location) {
      return new Response(JSON.stringify({ resolvedUrl: location }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If no redirect header, return the original URL
    return new Response(JSON.stringify({ resolvedUrl: targetUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error resolving TikTok URL:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
