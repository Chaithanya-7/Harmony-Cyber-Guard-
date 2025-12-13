// Hook for browser push notifications for fraud alerts

import { useState, useEffect, useCallback } from 'react';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('[Notifications] Browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('[Notifications] Permission request failed:', error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((options: NotificationOptions): Notification | null => {
    if (!isSupported || permission !== 'granted') {
      console.warn('[Notifications] Cannot send notification - permission not granted');
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        requireInteraction: options.requireInteraction ?? true,
      });

      if (options.onClick) {
        notification.onclick = () => {
          window.focus();
          options.onClick?.();
          notification.close();
        };
      }

      return notification;
    } catch (error) {
      console.error('[Notifications] Failed to send notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const sendFraudAlert = useCallback((
    riskLevel: 'warning' | 'blocked',
    riskScore: number,
    indicators: string[],
    onClickNavigate?: () => void
  ) => {
    const isHighRisk = riskLevel === 'blocked';
    
    const title = isHighRisk 
      ? '🚨 High-Risk Fraud Detected!' 
      : '⚠️ Suspicious Activity Warning';
    
    const body = isHighRisk
      ? `Risk Score: ${riskScore.toFixed(0)}%. Fraudulent patterns detected. ${indicators.slice(0, 2).join(', ')}`
      : `Risk Score: ${riskScore.toFixed(0)}%. ${indicators[0] || 'Suspicious patterns detected'}`;

    return sendNotification({
      title,
      body,
      tag: `fraud-alert-${Date.now()}`,
      requireInteraction: isHighRisk,
      onClick: onClickNavigate,
    });
  }, [sendNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    sendFraudAlert,
  };
}
