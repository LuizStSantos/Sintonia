export function InfoDialog({ open, title, message, linkLabel, onLinkClick, onClose }) {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-panel" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        {linkLabel && (
          <p className="agency-notice">
            <button type="button" className="link-btn" onClick={onLinkClick}>{linkLabel}</button>
          </p>
        )}
        <div className="drawer-actions">
          <button className="btn-primary view-close-btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

