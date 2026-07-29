// Custom confirm dialog. Used instead of window.confirm() anywhere
// the app needs a yes/no decision from the user (e.g. reverting a form).
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <p className="muted">{message}</p>}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
