const CACHE_NAME = 'trustcircle-v2';
const STATIC_ASSETS = [
  '/',
  '/badge',
  '/verify',
  '/verifying',
  '/checkin',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, update in background
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't cache API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        // Update cache in background
        fetch(event.request).then((freshResponse) => {
          if (freshResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, freshResponse);
            });
          }
        });
        return response;
      }

      return fetch(event.request).then((freshResponse) => {
        if (freshResponse.ok && event.request.method === 'GET') {
          const responseClone = freshResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return freshResponse;
      });
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};

  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'trustcircle-notification',
    renotify: true, // Notify even if same tag
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };

  // Set appropriate actions based on notification type
  const notificationType = data.data?.type;

  if (notificationType === 'checkin') {
    options.actions = [
      { action: 'verify', title: 'Verify Now' },
      { action: 'dismiss', title: 'Later' },
    ];
    options.requireInteraction = true;
    options.tag = `checkin-${data.data?.challengeId || Date.now()}`;
  } else if (notificationType === 'incident') {
    options.actions = [
      { action: 'view', title: 'View Alert' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
    options.tag = `incident-${data.data?.incidentId || Date.now()}`;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'TrustCircle', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};

  // Handle dismiss action - just close
  if (action === 'dismiss' || action === 'later') {
    return;
  }

  // Determine URL based on notification type and action
  let urlToOpen = '/';

  if (notificationData.url) {
    urlToOpen = notificationData.url;
  } else if (notificationData.type === 'checkin') {
    urlToOpen = notificationData.challengeId
      ? `/checkin?challenge=${notificationData.challengeId}`
      : '/checkin';
  } else if (notificationData.type === 'incident') {
    urlToOpen = notificationData.incidentId
      ? `/alerts?incident=${notificationData.incidentId}`
      : '/alerts';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find an existing window and navigate it
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          return client.navigate(urlToOpen).then(() => client.focus());
        }
      }

      // No existing window, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event (for analytics if needed)
self.addEventListener('notificationclose', (event) => {
  const notificationData = event.notification.data || {};

  // Could log dismissal for analytics
  console.log('Notification dismissed:', notificationData.type, notificationData);
});

// Background sync (for offline actions)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-movement') {
    event.waitUntil(syncMovementData());
  } else if (event.tag === 'sync-presence') {
    event.waitUntil(syncPresenceData());
  }
});

async function syncMovementData() {
  // Get pending movement data from IndexedDB and sync
  // This is a placeholder for future offline support
  console.log('Syncing movement data...');
}

async function syncPresenceData() {
  // Get pending presence data from IndexedDB and sync
  // This is a placeholder for future offline support
  console.log('Syncing presence data...');
}

// Periodic background sync (for regular check-ins when app is in background)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-pending-checkins') {
    event.waitUntil(checkPendingCheckins());
  }
});

async function checkPendingCheckins() {
  // Fetch pending check-ins and show notification if needed
  // This requires periodic sync to be registered by the main app
  console.log('Checking for pending check-ins...');
}
