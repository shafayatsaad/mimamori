'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { patientEmail, alertCount: unreadAlertCount } = useAppContext();

  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsFetchError, setAlertsFetchError] = useState(false);
  const [localUnreadCount, setLocalUnreadCount] = useState(unreadAlertCount);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Keep local count in sync with context
  useEffect(() => {
    setLocalUnreadCount(unreadAlertCount);
  }, [unreadAlertCount]);

  // Close alerts dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setAlertsOpen(false);
      }
    }
    if (alertsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [alertsOpen]);

  const markAlertAsRead = useCallback(async (alertId: string) => {
    if (!patientEmail) return;
    try {
      const res = await fetch(`/api/alerts/${alertId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail }),
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
        setLocalUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark alert as read', err);
    }
  }, [patientEmail]);

  const handleBellClick = useCallback(async () => {
    if (!alertsOpen) {
      if (!patientEmail) {
        setAlertsOpen(true);
        return;
      }
      setAlertsLoading(true);
      setAlertsFetchError(false);
      setAlertsOpen(true);
      try {
        const res = await fetch(`/api/alerts?email=${encodeURIComponent(patientEmail)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
          setAlertsFetchError(false);
          // Mark all unread alerts as read
          const unreadAlerts = data.alerts.filter((a: Alert) => !a.read);
          for (const alert of unreadAlerts) {
            try {
              await fetch(`/api/alerts/${alert.id}/read`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: patientEmail }),
              });
            } catch {
              // Silently continue if one fails
            }
          }
          if (unreadAlerts.length > 0) {
            setAlerts(prev => prev.map(a => ({ ...a, read: true })));
            setLocalUnreadCount(0);
          }
        } else {
          setAlertsFetchError(true);
        }
      } catch (err) {
        console.error('Failed to fetch alerts', err);
        setAlertsFetchError(true);
      } finally {
        setAlertsLoading(false);
      }
    } else {
      setAlertsOpen(false);
    }
  }, [alertsOpen, patientEmail]);

  const retryFetchAlerts = useCallback(async () => {
    if (!patientEmail) return;
    setAlertsLoading(true);
    setAlertsFetchError(false);
    try {
      const res = await fetch(`/api/alerts?email=${encodeURIComponent(patientEmail)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.alerts)) {
        setAlerts(data.alerts);
        setAlertsFetchError(false);
        const unreadAlerts = data.alerts.filter((a: Alert) => !a.read);
        for (const alert of unreadAlerts) {
          try {
            await fetch(`/api/alerts/${alert.id}/read`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: patientEmail }),
            });
          } catch {
            // Silently continue if one fails
          }
        }
        if (unreadAlerts.length > 0) {
          setAlerts(prev => prev.map(a => ({ ...a, read: true })));
          setLocalUnreadCount(0);
        }
      } else {
        setAlertsFetchError(true);
      }
    } catch (err) {
      console.error('Failed to fetch alerts', err);
      setAlertsFetchError(true);
    } finally {
      setAlertsLoading(false);
    }
  }, [patientEmail]);

  return (
    <div className="relative" ref={alertsRef}>
      <button
        onClick={handleBellClick}
        className="w-10 h-10 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm transition-all hover:shadow-md relative"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        {localUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {localUnreadCount > 99 ? '99+' : localUnreadCount}
          </span>
        )}
      </button>

      {/* Alerts Dropdown */}
      <AnimatePresence>
        {alertsOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-16 sm:top-12 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Notifications</span>
              {alerts.filter(a => !a.read).length > 0 && (
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                  {alerts.filter(a => !a.read).length} new
                </span>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {alertsLoading ? (
                <div className="p-6 text-center">
                  <span className="text-sm text-gray-400 animate-pulse">Loading alerts...</span>
                </div>
              ) : alertsFetchError ? (
                <div className="p-6 text-center flex flex-col items-center gap-3">
                  <span className="text-sm text-gray-500">Unable to load notifications. Please try again.</span>
                  <button
                    onClick={retryFetchAlerts}
                    className="text-xs font-bold text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : alerts.length === 0 ? (
                <div className="p-6 text-center">
                  <span className="text-sm text-gray-400">No alerts</span>
                </div>
              ) : (
                alerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => {
                      if (!alert.read) {
                        markAlertAsRead(alert.id);
                      }
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!alert.read ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!alert.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${!alert.read ? 'text-gray-900' : 'text-gray-600'}`}>{alert.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(alert.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
