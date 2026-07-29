import { QRCodeCanvas } from 'qrcode.react'
import { GROUP_LABELS } from '../utils/ageUtils'

export default function QRCodeCard({ scoutId, fullName, groupCode, printable = false }) {
  return (
    <div className="id-badge" id={printable ? 'printable-badge' : undefined}>
      <div className="id-badge-inner">
        <div className="group-name">Ismaili District Boy Scouts · Zulfiqarabad</div>
        <div className="scout-name">{fullName || 'Scout Name'}</div>
        <div className="scout-id">{scoutId}</div>
        <div className="qr-frame">
          <QRCodeCanvas value={scoutId || 'PENDING'} size={140} fgColor="#1f3a22" />
        </div>
        <div className="helper-text" style={{ marginTop: 10 }}>
          {GROUP_LABELS[groupCode] || ''}
        </div>
      </div>
    </div>
  )
}
