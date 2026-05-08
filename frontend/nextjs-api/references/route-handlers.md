# Next.js Route Handlers — Advanced Patterns

## Streaming Response

```ts
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of generateChunks()) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
```

## CORS

```ts
const ALLOWED_ORIGINS = ['https://app.example.com'];

export function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

## Webhook Verification

```ts
export async function POST(req: NextRequest) {
  const body = await req.text();  // read as text to verify signature
  const signature = req.headers.get('x-webhook-signature') ?? '';

  const expected = createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);
  await handleWebhookEvent(event);
  return new NextResponse(null, { status: 204 });
}
```

## Rate Limiting with Upstash

```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '60 s'),
});

export async function POST(req: NextRequest) {
  const ip = req.ip ?? '127.0.0.1';
  const { success, limit, remaining } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': String(remaining) },
    });
  }

  // ... handle request
}
```

## Request ID Middleware

```ts
// middleware.ts
export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  return response;
}
```
