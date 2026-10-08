export default function AdminComingSoon({ title, note }) {
  return (
    <div className="receipt-card max-w-lg rounded-sm px-6 pb-8 pt-8">
      <h1 className="font-display text-xl text-cream">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        {note || "This module's API isn't built yet. The data model exists in backend/modules/admin/models — add a controller and routes, then wire this page to them."}
      </p>
    </div>
  );
}