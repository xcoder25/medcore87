import { NextRequest } from 'next/server';
import { subscribeMohEvents, type MohBrokerEvent } from '../../../../lib/mohEventBroker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: MohBrokerEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* stream already closed */
        }
      };

      send({ id: `MOH-INIT-${Date.now().toString(36)}`, type: 'connected', at: new Date().toISOString() });

      const unsub = subscribeMohEvents(send);
      const timer = setInterval(() => {
        send({ id: `MOH-PING-${Date.now().toString(36)}`, type: 'sync_tick', at: new Date().toISOString() });
      }, 15_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        unsub();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      if (req.signal) {
        req.signal.addEventListener('abort', cleanup);
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
