import { NextRequest } from 'next/server';
import { subscribeFacilityStream } from '../../../../lib/sseBroker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/facility/stream?facilityId=IGH-EKT
 * Real-time Server-Sent Events (SSE) push stream for hospital workstations.
 */
export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'DEFAULT').trim().toUpperCase();
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (eventName: string, data: unknown) => {
        try {
          const chunk = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* stream closed */
        }
      };

      // Initial handshake event
      send('connected', {
        ok: true,
        facilityId,
        timestamp: new Date().toISOString(),
      });

      const unsub = subscribeFacilityStream(facilityId, (ev) => {
        send('facility-update', ev);
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 20000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsub();
      };

      req.signal.addEventListener('abort', () => {
        if (cleanup) cleanup();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
