import { GROUP_LABELS } from '../utils/ageUtils'

// Shown to the admin whenever the daily age-check finds scouts who have
// crossed an age boundary (e.g. turned 12, or turned 18). The admin does
// NOT get a button that silently moves the record -- per the club's
// process, a promotion must go through the same "revert" flow used for
// corrections, so the leader manually re-enters the scout in the new
// group's table. This modal only lets the admin kick off that revert.
export default function PromotionModal({ open, pending, onStartRevert, onDismiss }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>🎉 Promotion due</h3>
        <p className="muted">
          {pending.length} scout{pending.length > 1 ? 's have' : ' has'} crossed into a new age
          group based on today's date. Promotions must be completed by reverting the form to the
          leader so it can be re-entered under the new group.
        </p>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pending.map((s) => (
            <div
              key={`${s.currentTable}-${s.id}`}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div>
                <strong>{s.full_name}</strong>
                <div className="helper-text">
                  {s.scout_id} · {GROUP_LABELS[s.currentGroup]} → {GROUP_LABELS[s.targetGroup || s.promotion_target]}
                </div>
              </div>
              <button className="btn btn-gold btn-sm" onClick={() => onStartRevert(s)}>
                Revert for promotion
              </button>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onDismiss}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
