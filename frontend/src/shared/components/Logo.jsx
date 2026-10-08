// Single shared brand mark — imported on every page (auth screens, sidebar,
// portal, 404) so the brand is consistent without copy-pasting markup.
// Image lives at frontend/public/logo.png, served at /logo.png in both dev
// and prod (no import/bundling needed for files in /public).
export default function Logo({ compact = false, className = "", imgClassName }) {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/logo.png"
        alt="Samsthe"
        className={imgClassName || (compact ? "h-12 w-auto" : "h-10 w-auto")}
      />
    </div>
  );
}

