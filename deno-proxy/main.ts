/**
 * Прокси для Supabase на Deno Deploy.
 *
 * Зачем: провайдер блокирует прямое обращение к fmonxvjihcdbeklmwtmm.supabase.co
 * и домен *.workers.dev, но до *.deno.dev доходит. Браузер ходит на Deno Deploy,
 * тот пересылает запросы в Supabase. Все заголовки (apikey, Authorization и др.)
 * пробрасываются без изменений, логика сайта не меняется.
 */

// Supabase, к которому обращается прокси
const UPSTREAM = 'https://fmonxvjihcdbeklmwtmm.supabase.co';

// CORS-заголовки: разрешаем любому статическому сайту обращаться к прокси
function buildCorsHeaders() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('Access-Control-Expose-Headers', '*');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, UPSTREAM);

  // Короткий ответ на предварительный CORS-запрос
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(),
    });
  }

  // Формируем запрос к Supabase. Тело (файлы при загрузке) передаём потоком
  // без буферизации целиком — это важно для больших файлов.
  const headers = new Headers(request.headers);
  headers.delete('host');

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });
  } catch (err) {
    return new Response(JSON.stringify({
      message: `Прокси не смог достучаться до Supabase: ${(err instanceof Error) ? err.message : String(err)}`,
    }), {
      status: 502,
      headers: {
        ...buildCorsHeaders(),
        'Content-Type': 'application/json',
      },
    });
  }

  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });

  const corsHeaders = buildCorsHeaders();
  corsHeaders.forEach((value, key) => {
    if (!response.headers.has(key)) response.headers.set(key, value);
  });

  return response;
});