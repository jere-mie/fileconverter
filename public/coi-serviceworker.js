if (typeof window === 'undefined') {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
      return;
    }

    event.respondWith((async () => {
      const response = await fetch(request);

      if (response.status === 0) {
        return response;
      }

      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    })());
  });
} else {
  (() => {
    if (window.crossOriginIsolated || !window.isSecureContext) {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('Cross-origin isolation fallback is unavailable: service workers are not supported in this browser.');
      return;
    }

    navigator.serviceWorker.register('/coi-serviceworker.js').then((registration) => {
      if (registration.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      }
    }).catch((error) => {
      console.error('Failed to register COI service worker.', error);
    });
  })();
}