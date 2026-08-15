"use client";

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  preventDismiss,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  /** For forms with unsaved changes: no X button, no backdrop-click-to-close --
   * only the form's own Cancel/Save buttons can leave. */
  preventDismiss?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(41, 36, 32, 0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "2rem 1rem",
        overflowY: "auto",
        zIndex: 100,
      }}
      onClick={preventDismiss ? undefined : onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: wide ? 720 : 480, marginBottom: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {!preventDismiss && (
            <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
              Close
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
