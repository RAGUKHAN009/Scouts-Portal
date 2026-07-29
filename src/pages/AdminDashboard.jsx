
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'

import ConfirmModal from '../components/ConfirmModal'
import PromotionModal from '../components/PromotionModal'

import {
  GROUP_LABELS,
  GROUP_TABLES,
} from '../utils/ageUtils'

import {
  runDailyPromotionCheck,
  getPendingPromotions,
} from '../utils/promotionCheck'

const TABS = ['SS', 'BS', 'RS']

export default function AdminDashboard() {
  const { profile } = useAuth()
  const { showAlert } = useAlert()

  // =====================================================
  // STATE
  // =====================================================

  const [activeTab, setActiveTab] = useState('SS')

  const [scouts, setScouts] = useState({
    SS: [],
    BS: [],
    RS: [],
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [revertTarget, setRevertTarget] = useState(null)
  const [revertReason, setRevertReason] = useState('')
  const [reverting, setReverting] = useState(false)

  const [pendingPromotions, setPendingPromotions] = useState([])
  const [showPromotionModal, setShowPromotionModal] = useState(false)
  const [checkingPromotions, setCheckingPromotions] = useState(false)

  // =====================================================
  // LOAD ALL SCOUTS
  // =====================================================

  async function loadAllScouts() {
    setLoading(true)
    setError('')

    const result = {
      SS: [],
      BS: [],
      RS: [],
    }

    try {
      for (const groupCode of TABS) {
        const table = GROUP_TABLES[groupCode]

        if (!table) {
          console.warn(
            `No table configured for group ${groupCode}`
          )
          continue
        }

        const { data, error: fetchError } = await supabase
          .from(table)
          .select('*')
          .order('created_at', {
            ascending: false,
          })

        if (fetchError) {
          console.error(
            `Error loading ${table}:`,
            fetchError
          )

          throw fetchError
        }

        result[groupCode] = data || []
      }

      setScouts(result)
    } catch (err) {
      console.error(
        'Failed to load scouts:',
        err
      )

      setError(
        err?.message ||
        'Could not load scout records.'
      )

      showAlert(
        err?.message ||
        'Could not load scout records.',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // CHECK PROMOTIONS
  // =====================================================

  async function checkPromotions(force = false) {
    setCheckingPromotions(true)

    try {
      await runDailyPromotionCheck({
        force,
      })

      const pending =
        await getPendingPromotions()

      setPendingPromotions(
        pending || []
      )

      if (
        pending &&
        pending.length > 0
      ) {
        setShowPromotionModal(true)
      }

      // Reload records because promotion
      // checking may have updated the DB.
      await loadAllScouts()
    } catch (err) {
      console.error(
        'Promotion check error:',
        err
      )

      showAlert(
        err?.message ||
        'Could not check promotions.',
        'error'
      )
    } finally {
      setCheckingPromotions(false)
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    async function initialize() {
      await loadAllScouts()
      await checkPromotions()
    }

    initialize()
  }, [])

  // =====================================================
  // CLEAR SEARCH WHEN CHANGING GROUP
  // =====================================================

  useEffect(() => {
    setSearch('')
  }, [activeTab])

  // =====================================================
  // ASK TO REVERT
  // =====================================================

  function askRevert(
    scout,
    table,
    groupCode
  ) {
    setRevertTarget({
      ...scout,
      table,
      groupCode,
      mode: 'correction',
    })

    setRevertReason('')
  }

  // =====================================================
  // START PROMOTION REVERT
  // =====================================================

  function startPromotionRevert(scout) {
    setShowPromotionModal(false)

    const targetGroup =
      scout.targetGroup ||
      scout.promotion_target

    setRevertTarget({
      ...scout,

      table:
        scout.currentTable,

      groupCode:
        scout.currentGroup,

      mode:
        'promotion',

      targetGroup,
    })

    setRevertReason(
      `Promotion to ${GROUP_LABELS[targetGroup] ||
      'new group'
      }`
    )
  }

  // =====================================================
  // CONFIRM REVERT
  // =====================================================

  async function confirmRevert() {
    if (!revertTarget) return

    if (!profile?.id) {
      showAlert(
        'Admin account information is missing.',
        'error'
      )

      return
    }

    const {
      table,
      id,
      mode,
    } = revertTarget

    if (!table || !id) {
      showAlert(
        'Scout record information is missing.',
        'error'
      )

      return
    }

    setReverting(true)

    try {
      const {
        error: updateError,
      } = await supabase
        .from(table)
        .update({
          status: 'reverted',

          reverted_by:
            profile.id,

          revert_reason:
            revertReason ||
            (
              mode === 'promotion'
                ? 'Promotion'
                : 'Correction needed'
            ),

          revert_mode:
            mode,

          reverted_at:
            new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        throw updateError
      }

      // =================================================
      // ACTIVITY LOG
      // =================================================

      const {
        error: logError,
      } = await supabase
        .from('activity_logs')
        .insert({
          actor_id:
            profile.id,

          action:
            mode === 'promotion'
              ? 'promotion_reverted'
              : 'form_reverted',

          target_table:
            table,

          target_id:
            id,

          details: {
            reason:
              revertReason,

            by:
              profile.full_name,
          },
        })

      if (logError) {
        console.error(
          'Activity log error:',
          logError
        )
      }

      showAlert(
        `Form sent back to leader for ${mode === 'promotion'
          ? 'promotion'
          : 'correction'
        }.`,
        'success'
      )

      setRevertTarget(null)
      setRevertReason('')

      await loadAllScouts()
    } catch (err) {
      console.error(
        'Revert error:',
        err
      )

      showAlert(
        err?.message ||
        'Could not revert this form.',
        'error'
      )
    } finally {
      setReverting(false)
    }
  }

  // =====================================================
  // PRINTABLE BADGE
  // =====================================================

  function printBadge(
    scout,
    groupCode
  ) {
    const groupLabel =
      GROUP_LABELS[groupCode] ||
      groupCode

    const photo =
      scout.photo_url ||
      scout.image_url ||
      scout.photo ||
      ''

    const badgeWindow =
      window.open(
        '',
        '_blank',
        'width=700,height=800'
      )

    if (!badgeWindow) {
      showAlert(
        'Please allow pop-ups to print the badge.',
        'error'
      )

      return
    }

    const safe = (value) =>
      String(value ?? '')
        .replace(
          /&/g,
          '&amp;'
        )
        .replace(
          /</g,
          '&lt;'
        )
        .replace(
          />/g,
          '&gt;'
        )
        .replace(
          /"/g,
          '&quot;'
        )
        .replace(
          /'/g,
          '&#039;'
        )

    badgeWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scout Badge - ${safe(
      scout.full_name
    )}</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 30px;
            font-family:
              Arial,
              Helvetica,
              sans-serif;
            background: #f3f4f6;
          }

          .badge {
            width: 420px;
            margin: 0 auto;
            background: white;
            border: 2px solid #111827;
            border-radius: 18px;
            overflow: hidden;
            box-shadow:
              0 10px 30px
              rgba(0,0,0,.15);
          }

          .badge-header {
            background: #111827;
            color: white;
            text-align: center;
            padding: 18px;
          }

          .badge-header h1 {
            margin: 0;
            font-size: 24px;
          }

          .badge-header p {
            margin: 6px 0 0;
            font-size: 14px;
          }

          .photo-area {
            padding: 22px 20px 10px;
            text-align: center;
          }

          .photo {
            width: 130px;
            height: 150px;
            object-fit: cover;
            border: 2px solid #111827;
            border-radius: 8px;
            background: #e5e7eb;
          }

          .no-photo {
            width: 130px;
            height: 150px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #111827;
            border-radius: 8px;
            background: #e5e7eb;
            color: #6b7280;
            font-size: 13px;
          }

          .scout-name {
            margin-top: 12px;
            font-size: 22px;
            font-weight: 700;
          }

          .group {
            margin-top: 5px;
            font-size: 15px;
            font-weight: 600;
          }

          .details {
            padding: 15px 25px 25px;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }

          .label {
            font-weight: 700;
            color: #374151;
          }

          .value {
            text-align: right;
            color: #111827;
          }

          .footer {
            padding: 14px;
            background: #f3f4f6;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
          }

          @media print {
            @page {
              size: auto;
              margin: 10mm;
            }

            body {
              padding: 0;
              background: white;
            }

            .badge {
              box-shadow: none;
            }
          }
        </style>
      </head>

      <body>

        <div class="badge">

          <div class="badge-header">
            <h1>Zulfiqarabad Boy Scouts Group</h1>
            <p>${safe(groupLabel)}</p>
          </div>

          <div class="photo-area">

            ${photo
        ? `
                  <img
                    class="photo"
                    src="${safe(photo)}"
                    alt="Scout"
                  />
                `
        : `
                  <div class="no-photo">
                    No Photo
                  </div>
                `
      }

            <div class="scout-name">
              ${safe(
        scout.full_name
      )}
            </div>

            <div class="group">
              ${safe(groupLabel)}
            </div>

          </div>

          <div class="details">

            <div class="row">
              <span class="label">
                Scout ID
              </span>

              <span class="value">
                ${safe(
        scout.scout_id
      )}
              </span>
            </div>

            <div class="row">
              <span class="label">
                Father's Name
              </span>

              <span class="value">
                ${safe(
        scout.father_name
      )}
              </span>
            </div>

            <div class="row">
              <span class="label">
                Contact
              </span>

              <span class="value">
                ${safe(
        scout.contact_number
      )}
              </span>
            </div>

            ${scout.blood_group
        ? `
                  <div class="row">
                    <span class="label">
                      Blood Group
                    </span>

                    <span class="value">
                      ${safe(
          scout.blood_group
        )}
                    </span>
                  </div>
                `
        : ''
      }

            ${scout.date_of_birth
        ? `
                  <div class="row">
                    <span class="label">
                      Date of Birth
                    </span>

                    <span class="value">
                      ${safe(
          scout.date_of_birth
        )}
                    </span>
                  </div>
                `
        : ''
      }

            <div class="row">
              <span class="label">
                Status
              </span>

              <span class="value">
                ${safe(
        scout.status
      )}
              </span>
            </div>

          </div>

          <div class="footer">
            Official Scout Record
          </div>

        </div>

        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print()
            }, 500)
          }

          window.onafterprint = function () {
            window.close()
          }
        </script>

      </body>
      </html>
    `)

    badgeWindow.document.close()
  }

  // =====================================================
  // CURRENT TABLE
  // =====================================================

  const activeTable =
    GROUP_TABLES[activeTab]

  // =====================================================
  // CURRENT GROUP SCOUTS
  // =====================================================

  const currentScouts =
    scouts[activeTab] || []

  // =====================================================
  // SEARCHED LIST
  // =====================================================

  const list = useMemo(() => {
    const query =
      search
        .trim()
        .toLowerCase()

    if (!query) {
      return currentScouts
    }

    return currentScouts.filter(
      (scout) => {
        const searchableText = [
          scout.scout_id,
          scout.full_name,
          scout.father_name,
          scout.contact_number,
          scout.cnic,
          scout.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return searchableText.includes(
          query
        )
      }
    )
  }, [
    currentScouts,
    search,
  ])

  // =====================================================
  // TOTAL STATISTICS
  // =====================================================

  const totals = useMemo(() => {
    const allScouts =
      TABS.flatMap(
        (tab) =>
          scouts[tab] || []
      )

    return {
      all:
        allScouts.length,

      active:
        allScouts.filter(
          (scout) =>
            scout.status ===
            'active'
        ).length,

      reverted:
        allScouts.filter(
          (scout) =>
            scout.status ===
            'reverted'
        ).length,

      pendingPromo:
        allScouts.filter(
          (scout) =>
            scout.promotion_due ===
            true ||
            scout.promotion_due ===
            'true'
        ).length,
    }
  }, [scouts])

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="container">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="section-title">

        <div>
          <h2>
            Admin Dashboard
          </h2>

          <p
            style={{
              marginTop: 4,
              opacity: 0.7,
            }}
          >
            Manage scout records,
            promotions and badges.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() =>
            checkPromotions(true)
          }
          disabled={
            checkingPromotions
          }
        >
          {checkingPromotions
            ? 'Checking...'
            : '🔄 Re-check ages now'}
        </button>

      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            color: '#b91c1c',
          }}
        >
          {error}
        </div>
      )}

      {/* =================================================
          STATISTICS
      ================================================= */}

      <div className="stats-row">

        <div className="stat-card">
          <div className="num">
            {totals.all}
          </div>

          <div className="label">
            Total Scouts
          </div>
        </div>

        <div className="stat-card">
          <div className="num">
            {totals.active}
          </div>

          <div className="label">
            Active
          </div>
        </div>

        <div className="stat-card">
          <div className="num">
            {totals.reverted}
          </div>

          <div className="label">
            Reverted / Pending Fix
          </div>
        </div>

        <div className="stat-card">
          <div className="num">
            {totals.pendingPromo}
          </div>

          <div className="label">
            Promotion Due
          </div>
        </div>

      </div>

      {/* =================================================
          GROUP TABS
      ================================================= */}

      <div className="tabs">

        {TABS.map((tab) => {

          const groupCount =
            scouts[tab]?.length || 0

          return (
            <button
              key={tab}
              type="button"
              className={`tab-btn ${activeTab === tab
                ? 'active'
                : ''
                }`}
              onClick={() =>
                setActiveTab(tab)
              }
            >
              {GROUP_LABELS[tab] ||
                tab}

              {' ('}

              {groupCount}

              {')'}
            </button>
          )
        })}

      </div>

      {/* =================================================
          SEARCH
      ================================================= */}

      <div
        className="field"
        style={{
          maxWidth: 420,
          marginBottom: 18,
        }}
      >

        <label>
          Search {GROUP_LABELS[activeTab] || activeTab}
        </label>

        <input
          type="text"
          placeholder="Name, Scout ID, father's name, contact..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />

      </div>

      {/* =================================================
          RESULT INFORMATION
      ================================================= */}

      {!loading && (
        <div
          style={{
            marginBottom: 12,
            fontSize: 14,
            opacity: 0.7,
          }}
        >
          Showing {list.length} of{' '}
          {currentScouts.length}{' '}
          scouts
        </div>
      )}

      {/* =================================================
          TABLE
      ================================================= */}

      {loading ? (

        <div
          style={{
            display: 'flex',
            justifyContent:
              'center',
            padding: 50,
          }}
        >
          <div className="spinner" />
        </div>

      ) : list.length === 0 ? (

        <div className="card empty-state">

          <h3>
            No scouts found
          </h3>

          <p>
            {search
              ? 'Try a different search.'
              : `There are no scouts in ${GROUP_LABELS[activeTab] ||
              activeTab
              }.`}
          </p>

        </div>

      ) : (

        <div className="table-wrap">

          <table>

            <thead>

              <tr>
                <th>Scout ID</th>
                <th>Name</th>
                <th>Father's Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {list.map(
                (scout) => {

                  const isActive =
                    scout.status ===
                    'active'

                  const isReverted =
                    scout.status ===
                    'reverted'

                  const isPromotionDue =
                    scout.promotion_due ===
                    true ||
                    scout.promotion_due ===
                    'true'

                  return (

                    <tr
                      key={
                        scout.id
                      }
                    >

                      {/* SCOUT ID */}
                      <td>
                        <strong>
                          {scout.scout_id ||
                            '—'}
                        </strong>
                      </td>

                      {/* NAME */}
                      <td>
                        {scout.full_name ||
                          '—'}
                      </td>

                      {/* FATHER */}
                      <td>
                        {scout.father_name ||
                          '—'}
                      </td>

                      {/* CONTACT */}
                      <td>
                        {scout.contact_number ||
                          '—'}
                      </td>

                      {/* STATUS */}
                      <td>

                        <div
                          style={{
                            display:
                              'flex',
                            flexDirection:
                              'column',
                            gap: 5,
                            alignItems:
                              'flex-start',
                          }}
                        >

                          <span
                            className={`pill ${isActive
                              ? 'pill-active'
                              : isReverted
                                ? 'pill-reverted'
                                : 'pill-pending'
                              }`}
                          >
                            {scout.status ||
                              'pending'}
                          </span>

                          {isPromotionDue && (
                            <span
                              className="pill pill-pending"
                            >
                              Promotion due
                            </span>
                          )}

                        </div>

                      </td>

                      {/* ACTIONS */}
                      <td>

                        <div
                          style={{
                            display:
                              'flex',
                            gap: 6,
                            flexWrap:
                              'wrap',
                          }}
                        >

                        

                          {/* PRINT BADGE */}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() =>
                              printBadge(
                                scout,
                                activeTab
                              )
                            }
                          >
                            🖨️ Badge
                          </button>

                          {/* REVERT */}
                          {isActive && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() =>
                                askRevert(
                                  scout,
                                  activeTable,
                                  activeTab
                                )
                              }
                            >
                              Revert
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>

                  )
                }
              )}

            </tbody>

          </table>

        </div>

      )}

      {/* =================================================
          REVERT MODAL
      ================================================= */}

      <ConfirmModal
        open={
          Boolean(
            revertTarget
          )
        }

        title={
          revertTarget?.mode ===
            'promotion'
            ? 'Revert for Promotion'
            : 'Revert Form'
        }

        danger={
          revertTarget?.mode !==
          'promotion'
        }

        confirmLabel={
          reverting
            ? 'Sending...'
            : 'Send Back to Leader'
        }

        onCancel={() => {
          if (reverting) return

          setRevertTarget(null)
          setRevertReason('')
        }}

        onConfirm={
          confirmRevert
        }

        message={
          <>

            <span>
              Sending "
              {revertTarget?.full_name}
              "'s form back to
              their leader.
            </span>

            <div
              className="field"
              style={{
                marginTop: 12,
              }}
            >

              <label>
                Reason
              </label>

              <textarea
                value={
                  revertReason
                }
                onChange={(e) =>
                  setRevertReason(
                    e.target.value
                  )
                }
                disabled={
                  reverting
                }
                placeholder="e.g. Incorrect CNIC number, blurry photo, etc."
              />

            </div>

          </>
        }
      />

      {/* =================================================
          PROMOTION MODAL
      ================================================= */}

      <PromotionModal
        open={
          showPromotionModal
        }

        pending={
          pendingPromotions
        }

        onStartRevert={
          startPromotionRevert
        }

        onDismiss={() =>
          setShowPromotionModal(
            false
          )
        }
      />

    </div>
  )
}

