import { Bell, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AppNotification = { id: string; extensionId: string; extensionName: string; title: string; body: string; createdAt: number };

type Props = { notifications: AppNotification[]; onDismiss: (id: string) => void; onClear: () => void };

export default function NotificationCenter({ notifications, onDismiss, onClear }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toastIds, setToastIds] = useState<string[]>([]);
  const seenIds = useRef(new Set<string>());
  useEffect(() => {
    const latest = notifications.filter((notification) => !seenIds.current.has(notification.id));
    if (!latest.length) return;
    for (const notification of latest) {
      seenIds.current.add(notification.id);
      setToastIds((current) => [...current, notification.id].slice(-3));
      window.setTimeout(() => setToastIds((current) => current.filter((id) => id !== notification.id)), 5000);
    }
  }, [notifications]);
  const toastNotifications = toastIds.map((id) => notifications.find((notification) => notification.id === id)).filter((notification): notification is AppNotification => Boolean(notification));
  return <div className="notification-center" aria-live="polite">
    <div className="notification-toasts" aria-live="polite">
      {toastNotifications.map((notification) => <article className="notification-toast" key={notification.id}>
        <div className="notification-toast-icon"><Bell size={15} /></div>
        <div className="notification-copy"><strong>{notification.title}</strong><p>{notification.body}</p><small>{notification.extensionName}</small></div>
        <button onClick={() => { setToastIds((current) => current.filter((id) => id !== notification.id)); }} title="Dismiss notification" aria-label={`Dismiss ${notification.title}`}><X size={14} /></button>
      </article>)}
    </div>
    <button className="notification-bell" onClick={() => setHistoryOpen((open) => !open)} title="Notification history" aria-label={`Notifications (${notifications.length})`} aria-expanded={historyOpen}>
      <Bell size={16} />{notifications.length > 0 && <span>{Math.min(notifications.length, 99)}</span>}
    </button>
    {historyOpen && <section className="notification-history" aria-label="Notification history">
      <header><strong>Notifications</strong><button onClick={onClear} disabled={!notifications.length}>Clear all</button><button onClick={() => setHistoryOpen(false)} aria-label="Close notifications"><X size={14} /></button></header>
      {notifications.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : <div className="notification-history-list">
        {[...notifications].reverse().map((notification) => <article key={notification.id}>
          <div className="notification-copy"><strong>{notification.title}</strong><p>{notification.body}</p><small>{notification.extensionName} · {new Date(notification.createdAt).toLocaleTimeString()}</small></div>
          <button onClick={() => onDismiss(notification.id)} title="Dismiss notification" aria-label={`Dismiss ${notification.title}`}><Check size={13} /></button>
        </article>)}
      </div>}
    </section>}
  </div>;
}
