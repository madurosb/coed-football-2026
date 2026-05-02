const CACHE_NAME = 'coed-football-v3';

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;

  // Bypass — never intercept these
  if (url.includes('firestore.googleapis.com')) return;
  if (url.includes('firebase.google.com')) return;
  if (url.includes('googleapis.com')) return;
  if (url.includes('youtube.com')) return;
  if (url.includes('flagcdn.com')) return;
  if (url.includes('api.anthropic.com')) return;
  if (url.includes('football-data.org')) return;
  if (url.includes('gstatic.com')) return;
  if (url.includes('google.com')) return;
  // Always bypass video/media files and coaches folder
  if (url.includes('/coaches/')) return;
  if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok && (url.includes('/avatars/') || url.includes('/icons/'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    e.waitUntil(self.registration.showNotification(data.title || '⚽ COED&FOOTBALL', {
      body: data.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-72.png',
      data: { url: data.url || '/' }
    }));
  } catch(err) {}
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
