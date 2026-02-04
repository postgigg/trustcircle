/**
 * Push Notification Client Library
 * Handles service worker registration and push subscription management
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Check if running as iOS PWA (home screen installed)
 */
export function isIOSPWA(): boolean {
  if (typeof window === 'undefined') return false;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return isIOS && isStandalone;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Check if notifications are supported (for iOS PWA check)
 * iOS 16.4+ supports notifications but only when installed as PWA
 */
export function areNotificationsSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window;
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!areNotificationsSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service worker registered:', registration.scope);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Request notification permission from the user
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!areNotificationsSupported()) {
    console.log('Notifications not supported');
    return false;
  }

  // Check if already granted
  if (Notification.permission === 'granted') {
    return true;
  }

  // Check if denied
  if (Notification.permission === 'denied') {
    console.log('Notification permission denied');
    return false;
  }

  // Request permission
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Subscribe to push notifications
 * Returns the subscription object or null on failure
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.error('VAPID public key not configured');
    return null;
  }

  try {
    // Check for existing subscription
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('Existing push subscription found');
      return existingSubscription;
    }

    // Create new subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    console.log('Push subscription created');
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

/**
 * Send push subscription to server
 */
export async function sendSubscriptionToServer(
  subscription: PushSubscription,
  deviceToken: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': deviceToken,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    console.log('Subscription sent to server');
    return true;
  } catch (error) {
    console.error('Failed to send subscription to server:', error);
    return false;
  }
}

/**
 * Full push notification setup flow
 * 1. Register service worker
 * 2. Request notification permission
 * 3. Subscribe to push
 * 4. Send subscription to server
 */
export async function setupPushNotifications(
  deviceToken: string
): Promise<{
  success: boolean;
  error?: string;
  subscription?: PushSubscription;
}> {
  // Check support
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications not supported' };
  }

  // Register service worker
  const registration = await registerServiceWorker();
  if (!registration) {
    return { success: false, error: 'Failed to register service worker' };
  }

  // Request permission
  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    return { success: false, error: 'Notification permission denied' };
  }

  // Subscribe to push
  const subscription = await subscribeToPush(registration);
  if (!subscription) {
    return { success: false, error: 'Failed to subscribe to push' };
  }

  // Send to server
  const serverSuccess = await sendSubscriptionToServer(subscription, deviceToken);
  if (!serverSuccess) {
    return { success: false, error: 'Failed to save subscription' };
  }

  return { success: true, subscription };
}

/**
 * Check if the device is eligible for push notifications
 * iOS requires PWA installation, Android/desktop can use browser
 */
export function checkPushEligibility(): {
  eligible: boolean;
  reason?: string;
  needsInstall?: boolean;
} {
  if (typeof window === 'undefined') {
    return { eligible: false, reason: 'Server-side rendering' };
  }

  // Check basic support
  if (!isPushSupported()) {
    return { eligible: false, reason: 'Push not supported by browser' };
  }

  // Check iOS-specific requirements
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream;

  if (isIOS) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      return {
        eligible: false,
        reason: 'iOS requires PWA installation for notifications',
        needsInstall: true,
      };
    }
  }

  return { eligible: true };
}
