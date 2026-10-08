import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import * as notificationsApi from "../api/notificationsApi";

const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export default function NotificationBell({ onNavigate, align = "left" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const prevUnread = useRef(null);
  const box = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await notificationsApi.list();
      setItems(d.notifications);
      setUnread(d.unreadCount);
    } catch { /* silent: polling */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  // Native browser notification when something new arrives (if the user allowed it)
  useEffect(() => {
    if (prevUnread.current !== null && unread > prevUnread.current && items[0] &&
        "Notification" in window && Notification.permission === "granted") {
      new Notification(items[0].title, { body: items[0].message });
    }
    prevUnread.current = unread;
  }, [unread, items]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
    if (!open) {
      load();
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    }
  }

  async function openItem(n) {
    setOpen(false);
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      notificationsApi.markRead(n._id).catch(() => {});
    }
    if (n.link?.section) onNavigate?.(n.link.section);
  }

  async function readAll() {
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    setUnread(0);
    notificationsApi.markAllRead().catch(() => {});
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-sm border border-charcoal-lighter text-muted hover:border-saffron hover:text-cream">
        <Bell size={16} strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-sm border border-charcoal-lighter bg-charcoal-light shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          <div className="flex items-center justify-between border-b border-charcoal-lighter px-4 py-2.5">
            <p className="text-sm font-medium text-cream">Notifications</p>
            {unread > 0 && <button onClick={readAll} className="text-xs text-saffron hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">You're all caught up.</p>
            ) : items.map((n) => (
              <button key={n._id} onClick={() => openItem(n)}
                className={`block w-full border-b border-charcoal-lighter/50 px-4 py-3 text-left last:border-0 hover:bg-charcoal ${n.readAt ? "" : "bg-saffron/5"}`}>
                <div className="flex items-start gap-2">
                  {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-saffron" />}
                  <div className="min-w-0">
                    <p className="text-sm text-cream">{n.title}</p>
                    <p className="line-clamp-2 text-xs text-muted">{n.message}</p>
                    <p className="mt-1 text-[11px] text-muted">{ago(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}