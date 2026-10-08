const TYPE_STYLE = {
  danger: "bg-brick/10 text-brick",
  warning: "bg-saffron/10 text-saffron",
  info: "bg-sage/10 text-sage",
};
const TYPE_ICON = { danger: "₹", warning: "!", info: "i" };

export default function NotificationsSection({ n, onNavigate }) {
  const { items, readIds, unread, loading, refresh, markRead, markAllRead } = n;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted">{unread > 0 ? `${unread} unread` : "You're all caught up."}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="rounded-sm border border-charcoal-lighter px-4 py-2 text-sm text-cream hover:border-saffron">Refresh</button>
          <button onClick={markAllRead} disabled={unread === 0}
            className="rounded-sm bg-saffron px-4 py-2 text-sm font-medium text-charcoal hover:bg-saffron-dark disabled:opacity-40">
            Mark all read
          </button>
        </div>
      </div>

      {loading ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="receipt-card rounded-sm p-10 text-center text-sm text-muted">Nothing needs your attention right now.</div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const isRead = readIds.has(it.id);
            return (
              <div key={it.id} className={`receipt-card relative flex items-start gap-3 rounded-sm px-4 pb-4 pt-6 ${isRead ? "opacity-60" : ""}`}>
                <span className="receipt-notch left-6" />
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${TYPE_STYLE[it.type]}`}>
                  {TYPE_ICON[it.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-cream">
                    {it.title}
                    {!isRead && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-saffron align-middle" />}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{it.body}</p>
                  <div className="mt-2 flex gap-4 text-xs">
                    <button onClick={() => { markRead(it.id); onNavigate(it.go); }} className="text-saffron hover:underline">View</button>
                    {!isRead && <button onClick={() => markRead(it.id)} className="text-muted hover:text-cream">Mark read</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}