import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { GROUP_LABELS, GROUP_TABLES } from '../utils/ageUtils'

export default function RevertedForms() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadRevertedForms() {
    if (!profile) return


    setLoading(true)

    const all = []

    for (const [groupCode, table] of Object.entries(GROUP_TABLES)) {
      const { data, error } = await supabase
        .from(table)
        .select(
          'id, scout_id, full_name, revert_reason, revert_mode, updated_at'
        )
        .eq('leader_id', profile.id)
        .eq('status', 'reverted')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error(`Error loading reverted forms from ${table}:`, error)
        continue
      }

      if (data) {
        all.push(
          ...data.map((scout) => ({
            ...scout,
            groupCode,
            table,
          }))
        )
      }
    }

    all.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime()
    )

    setItems(all)
    setLoading(false)


  }

  useEffect(() => {
    if (profile) {
      loadRevertedForms()
    }
  }, [profile])

  function openForCorrection(item) {
    navigate(`/dashboard/edit/${item.table}/${item.id}`, {
      state: {
        mode: item.revert_mode || 'correction',
      },
    })
  }

  return (<div className="container"> <div className="section-title"> <h2>Reverted Forms</h2>


    <button
      className="btn btn-outline btn-sm"
      onClick={loadRevertedForms}
    >
      🔄 Refresh
    </button>
  </div>

    <p className="muted" style={{ marginBottom: 20 }}>
      Forms the admin has sent back to you for correction.
    </p>

    {loading ? (
      <div className="spinner" />
    ) : items.length === 0 ? (
      <div className="card empty-state">
        Nothing to fix right now. Great job! ✅
      </div>
    ) : (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {items.map((item) => (
          <div
            key={`${item.table}-${item.id}`}
            className="card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <strong>{item.full_name}</strong>{' '}
              <span className="muted">
                ({item.scout_id})
              </span>

              <div className="helper-text">
                {GROUP_LABELS[item.groupCode]}
              </div>

              <div
                className="helper-text"
                style={{ marginTop: 4 }}
              >
                <strong>Reason:</strong>{' '}
                {item.revert_reason || 'Not specified'}
              </div>
            </div>

            <button
              className="btn btn-gold btn-sm"
              onClick={() => openForCorrection(item)}
            >
              Open & Fix
            </button>
          </div>
        ))}
      </div>
    )}
  </div>


  )
}
