import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { GROUP_LABELS, GROUP_TABLES } from '../utils/ageUtils'

export default function LeaderDashboard() {
  const { profile } = useAuth()

  const [scouts, setScouts] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadMine() {
    if (!profile) return


    setLoading(true)

    const all = []

    for (const [groupCode, table] of Object.entries(GROUP_TABLES)) {
      const result = await supabase
        .from(table)
        .select(
          'id, scout_id, full_name, status, created_at, revert_reason, revert_mode'
        )
        .eq('leader_id', profile.id)
        .order('created_at', { ascending: false })

      const data = result.data
      const error = result.error

      if (error) {
        console.error(`Error loading ${table}:`, error)
        continue
      }

      if (data) {
        data.forEach((scout) => {
          all.push({
            ...scout,
            groupCode,
            table,
          })
        })
      }
    }

    all.sort((a, b) => {
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      )
    })

    setScouts(all)
    setLoading(false)


  }

  useEffect(() => {
    if (profile) {
      loadMine()
    }
  }, [profile])

  const revertedScouts = scouts.filter(
    (scout) => scout.status === 'reverted'
  )

  const pendingScouts = scouts.filter(
    (scout) => scout.status === 'pending'
  )

  const activeScouts = scouts.filter(
    (scout) => scout.status === 'active'
  )

  return (<div className="container"> <div className="section-title"> <h2>My Enrolled Scouts</h2>


    <Link
      to="/dashboard/new"
      className="btn btn-primary"
    >
      + New Scout Enrollment
    </Link>
  </div>

    <div className="stats-row">
      <div className="stat-card">
        <div className="num">
          {scouts.length}
        </div>
        <div className="label">
          Total Scouts
        </div>
      </div>

      <div className="stat-card">
        <div className="num">
          {pendingScouts.length}
        </div>
        <div className="label">
          Pending
        </div>
      </div>

      <div className="stat-card">
        <div className="num">
          {activeScouts.length}
        </div>
        <div className="label">
          Active
        </div>
      </div>

      <div className="stat-card">
        <div className="num">
          {revertedScouts.length}
        </div>
        <div className="label">
          Reverted
        </div>
      </div>
    </div>

    {loading ? (
      <div className="spinner" />
    ) : scouts.length === 0 ? (
      <div className="card empty-state">
        You haven't enrolled any scouts yet. Click
        "New Scout Enrollment" to fill in the first form.
      </div>
    ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scout ID</th>
              <th>Name</th>
              <th>Group</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {scouts.map((scout) => (
              <tr
                key={`${scout.table}-${scout.id}`}
              >
                <td>
                  {scout.scout_id}
                </td>

                <td>
                  {scout.full_name}
                </td>

                <td>
                  {GROUP_LABELS[scout.groupCode]}
                </td>

                <td>
                  <span
                    className={`pill ${scout.status === 'active'
                      ? 'pill-active'
                      : scout.status === 'reverted'
                        ? 'pill-reverted'
                        : 'pill-pending'
                      }`}
                  >
                    {scout.status}
                  </span>
                </td>

                <td>
                  {scout.status === 'reverted' ? (
                    <div>
                      <Link
                        to="/reverted"
                        className="btn btn-danger btn-sm"
                      >
                        Fix & Resubmit
                      </Link>

                      {scout.revert_reason && (
                        <div
                          className="helper-text"
                          style={{
                            marginTop: 6,
                          }}
                        >
                          Reason: {scout.revert_reason}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={`/dashboard/scout/${scout.table}/${scout.id}`}
                      className="btn btn-outline btn-sm"
                    >
                      View
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>


  )
}
