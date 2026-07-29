import { useEffect, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'

import CameraCapture from '../components/CameraCapture'
import QRCodeCard from '../components/QRCodeCard'

import {
  calculateAge,
  groupForAge,
  GROUP_LABELS,
  GROUP_TABLES,
} from '../utils/ageUtils'

import { generateScoutId } from '../utils/idGenerator'

const BLANK_FORM = {
  full_name: '',
  father_name: '',
  date_of_birth: '',
  cnic_or_bform: '',
  contact_number: '',
  address: '',
  blood_group: '',
  emergency_contact: '',
}

export default function ScoutForm() {
  const { table, id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const { profile } = useAuth()
  const { showAlert } = useAlert()

  // =====================================================
  // EDIT MODE
  // =====================================================

  const isEditMode = Boolean(table && id)

  const revertMode = location.state?.mode || 'correction'

  const promotionTargetGroup =
    location.state?.targetGroup || null

  // =====================================================
  // STATE
  // =====================================================

  const [form, setForm] = useState(BLANK_FORM)

  const [photoFile, setPhotoFile] = useState(null)

  const [existingPhotoUrl, setExistingPhotoUrl] =
    useState(null)

  const [existingScoutId, setExistingScoutId] =
    useState('')

  const [loading, setLoading] =
    useState(isEditMode)

  const [submitting, setSubmitting] =
    useState(false)

  const [deleting, setDeleting] =
    useState(false)

  const [generatedId, setGeneratedId] =
    useState(null)

  // =====================================================
  // LOAD EXISTING FORM
  // =====================================================

  useEffect(() => {
    if (!isEditMode || !table || !id) {
      setLoading(false)
      return
    }

    async function loadExisting() {
      setLoading(true)

      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('id', id)
          .single()

        if (error) {
          console.error(
            'Error loading existing form:',
            error
          )

          showAlert(
            error.message ||
            'Could not load this form.',
            'error'
          )

          navigate('/reverted')
          return
        }

        if (!data) {
          showAlert(
            'Scout form was not found.',
            'error'
          )

          navigate('/reverted')
          return
        }

        // ===============================================
        // LOAD EXISTING DATABASE VALUES
        // ===============================================

        setForm({
          full_name: data.full_name || '',
          father_name: data.father_name || '',
          date_of_birth: data.date_of_birth || '',
          cnic_or_bform: data.cnic_or_bform || '',
          contact_number: data.contact_number || '',
          address: data.address || '',
          blood_group: data.blood_group || '',
          emergency_contact:
            data.emergency_contact || '',
        })

        // Keep original Scout ID
        setExistingScoutId(
          data.scout_id || ''
        )

        // Keep existing photo
        setExistingPhotoUrl(
          data.photo_url || null
        )
      } catch (error) {
        console.error(
          'Unexpected loading error:',
          error
        )

        showAlert(
          'Something went wrong while loading the form.',
          'error'
        )

        navigate('/reverted')
      } finally {
        setLoading(false)
      }
    }

    loadExisting()
  }, [
    isEditMode,
    table,
    id,
    navigate,
    showAlert,
  ])

  // =====================================================
  // AGE
  // =====================================================

  const liveAge = calculateAge(
    form.date_of_birth
  )

  // =====================================================
  // DETERMINE GROUP
  // =====================================================
  //
  // NEW:
  //     Group is determined from current age.
  //
  // CORRECTION:
  //     Original table is ALWAYS retained.
  //
  //     Example:
  //     boy_scouts
  //     age 13
  //     reverted
  //     DOB changed → age 11
  //
  //     It remains in boy_scouts.
  //
  // PROMOTION:
  //     Explicit promotionTargetGroup is used.
  //
  // =====================================================

  let liveGroup = null

  if (isEditMode && revertMode === 'correction') {
    liveGroup =
      Object.entries(GROUP_TABLES).find(
        ([, tableName]) =>
          tableName === table
      )?.[0] || null
  } else if (
    isEditMode &&
    revertMode === 'promotion'
  ) {
    liveGroup = promotionTargetGroup
  } else {
    liveGroup = groupForAge(liveAge)
  }

  // =====================================================
  // UPDATE FORM FIELD
  // =====================================================

  function updateField(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  // =====================================================
  // UPLOAD PHOTO
  // =====================================================

  async function uploadPhoto(scoutId) {
    // No new photo selected
    // Keep existing photo
    if (!photoFile) {
      return existingPhotoUrl || null
    }

    const extension =
      photoFile.type?.includes('png')
        ? 'png'
        : 'jpg'

    const path =
      `${scoutId}-${Date.now()}.${extension}`

    const { error } =
      await supabase.storage
        .from('scout-photos')
        .upload(
          path,
          photoFile,
          {
            upsert: true,
            contentType:
              photoFile.type ||
              'image/jpeg',
          }
        )

    if (error) {
      throw error
    }

    const { data } =
      supabase.storage
        .from('scout-photos')
        .getPublicUrl(path)

    return data.publicUrl
  }

  // =====================================================
  // DELETE CURRENT FORM
  // =====================================================

  async function handleDelete() {
    if (!table || !id) {
      showAlert(
        'No form was selected.',
        'error'
      )
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${form.full_name || 'this scout'}'s form?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    if (!profile?.id) {
      showAlert(
        'Your account information could not be loaded.',
        'error'
      )
      return
    }

    setDeleting(true)

    try {
      const { data, error } =
        await supabase
          .from(table)
          .delete()
          .eq('id', id)
          .eq('leader_id', profile.id)
          .select('id')

      if (error) {
        console.error(
          'Delete error:',
          error
        )

        throw error
      }

      // If no row was deleted, RLS may be blocking it
      if (!data || data.length === 0) {
        showAlert(
          'The form could not be deleted. You may not have permission to delete this record.',
          'error'
        )

        return
      }

      showAlert(
        'Scout form deleted successfully.',
        'success'
      )

      navigate('/dashboard')
    } catch (error) {
      console.error(
        'Delete scout form error:',
        error
      )

      showAlert(
        error.message ||
        'Could not delete the form.',
        'error'
      )
    } finally {
      setDeleting(false)
    }
  }

  // =====================================================
  // SUBMIT FORM
  // =====================================================

  async function handleSubmit(e) {
    e.preventDefault()

    // ===================================================
    // VALIDATION
    // ===================================================

    if (!form.full_name.trim()) {
      showAlert(
        'Please enter the scout name.',
        'error'
      )
      return
    }

    if (!form.father_name.trim()) {
      showAlert(
        "Please enter the father's name.",
        'error'
      )
      return
    }

    if (!form.date_of_birth) {
      showAlert(
        'Please enter the scout date of birth.',
        'error'
      )
      return
    }

    if (liveAge === null) {
      showAlert(
        'Please enter a valid date of birth.',
        'error'
      )
      return
    }

    if (!liveGroup) {
      showAlert(
        'Could not determine the scout group.',
        'error'
      )
      return
    }

    if (!photoFile && !existingPhotoUrl) {
      showAlert(
        'Please add a photo of the scout.',
        'error'
      )
      return
    }

    if (!profile?.id) {
      showAlert(
        'Your account information could not be loaded.',
        'error'
      )
      return
    }

    setSubmitting(true)

    try {
      // =================================================
      // 1. CORRECTION
      // =================================================

      if (
        isEditMode &&
        revertMode === 'correction'
      ) {
        /*
          IMPORTANT:

          We DO NOT use groupForAge() here.

          We DO NOT change the database table
          because the DOB was changed.

          The original `table` is always used.

          Example:

          Original:
          boy_scouts

          Age:
          13

          Reverted.

          Leader changes DOB:
          age becomes 11.

          Still update:
          boy_scouts

          NOT:
          shaheen_scouts
        */

        if (!table) {
          throw new Error(
            'Original scout table is missing.'
          )
        }

        const scoutId =
          existingScoutId ||
          form.cnic_or_bform ||
          'scout'

        const photo_url =
          await uploadPhoto(scoutId)

        const { error } =
          await supabase
            .from(table)
            .update({
              full_name:
                form.full_name.trim(),

              father_name:
                form.father_name.trim(),

              date_of_birth:
                form.date_of_birth,

              cnic_or_bform:
                form.cnic_or_bform.trim(),

              contact_number:
                form.contact_number.trim(),

              address:
                form.address.trim(),

              blood_group:
                form.blood_group,

              emergency_contact:
                form.emergency_contact.trim(),

              photo_url,

              // Send back to admin
              status: 'pending',

              // Clear revert information
              reverted_by: null,

              revert_reason: null,

              revert_mode: null,

              promotion_due: false,

              promotion_target: null,

              updated_at:
                new Date().toISOString(),
            })
            .eq('id', id)
            .eq('leader_id', profile.id)

        if (error) {
          throw error
        }

        // ===============================================
        // ACTIVITY LOG
        // ===============================================

        const { error: logError } =
          await supabase
            .from('activity_logs')
            .insert({
              actor_id: profile.id,

              action:
                'form_resubmitted',

              target_table: table,

              target_id: id,

              details: {
                by: profile.full_name,

                age_after_correction:
                  liveAge,

                original_table:
                  table,

                group_retained:
                  liveGroup,
              },
            })

        if (logError) {
          console.error(
            'Activity log error:',
            logError
          )
        }

        showAlert(
          'Corrections submitted. The form is waiting for admin review.',
          'success'
        )

        navigate('/dashboard')

        return
      }

      // =================================================
      // 2. PROMOTION
      // =================================================

      if (
        isEditMode &&
        revertMode === 'promotion'
      ) {
        if (!promotionTargetGroup) {
          showAlert(
            'Promotion target group is missing.',
            'error'
          )
          return
        }

        const targetTable =
          GROUP_TABLES[
          promotionTargetGroup
          ]

        if (!targetTable) {
          showAlert(
            'Could not determine the promotion target table.',
            'error'
          )
          return
        }

        // ===============================================
        // GENERATE NEW ID
        // ===============================================

        const newScoutId =
          await generateScoutId(
            promotionTargetGroup
          )

        // ===============================================
        // UPLOAD PHOTO
        // ===============================================

        const photo_url =
          await uploadPhoto(newScoutId)

        // ===============================================
        // INSERT INTO NEW GROUP
        // ===============================================

        const {
          error: insertError,
        } = await supabase
          .from(targetTable)
          .insert({
            scout_id:
              newScoutId,

            full_name:
              form.full_name.trim(),

            father_name:
              form.father_name.trim(),

            date_of_birth:
              form.date_of_birth,

            cnic_or_bform:
              form.cnic_or_bform.trim(),

            contact_number:
              form.contact_number.trim(),

            address:
              form.address.trim(),

            blood_group:
              form.blood_group,

            emergency_contact:
              form.emergency_contact.trim(),

            photo_url,

            leader_id:
              profile.id,

            status:
              'pending',

            promotion_due:
              false,

            promotion_target:
              null,
          })

        if (insertError) {
          throw insertError
        }

        // ===============================================
        // MARK OLD FORM AS PROMOTED
        // ===============================================

        const {
          error: archiveError,
        } = await supabase
          .from(table)
          .update({
            status: 'promoted',
            promotion_due: false,
            promotion_target: null,
          })
          .eq('id', id)
          .eq('leader_id', profile.id)

        if (archiveError) {
          throw archiveError
        }

        // ===============================================
        // ACTIVITY LOG
        // ===============================================

        const {
          error: logError,
        } = await supabase
          .from('activity_logs')
          .insert({
            actor_id:
              profile.id,

            action:
              'scout_promoted',

            target_table:
              targetTable,

            target_id:
              null,

            details: {
              from:
                table,

              new_scout_id:
                newScoutId,

              target_group:
                promotionTargetGroup,

              by:
                profile.full_name,
            },
          })

        if (logError) {
          console.error(
            'Promotion log error:',
            logError
          )
        }

        showAlert(
          `Promotion submitted for admin review. New ID: ${newScoutId}`,
          'success'
        )

        setGeneratedId(
          newScoutId
        )

        return
      }

      // =================================================
      // 3. NEW SCOUT ENROLLMENT
      // =================================================

      const targetGroup =
        groupForAge(liveAge)

      if (!targetGroup) {
        showAlert(
          'Could not determine the scout group from the age.',
          'error'
        )
        return
      }

      const targetTable =
        GROUP_TABLES[targetGroup]

      if (!targetTable) {
        showAlert(
          'Could not find the database table for this group.',
          'error'
        )
        return
      }

      // ===============================================
      // GENERATE NEW ID
      // ===============================================

      const newScoutId =
        await generateScoutId(
          targetGroup
        )

      // ===============================================
      // UPLOAD PHOTO
      // ===============================================

      const photo_url =
        await uploadPhoto(newScoutId)

      // ===============================================
      // INSERT NEW RECORD
      // ===============================================

      const {
        error: insertError,
      } = await supabase
        .from(targetTable)
        .insert({
          scout_id:
            newScoutId,

          full_name:
            form.full_name.trim(),

          father_name:
            form.father_name.trim(),

          date_of_birth:
            form.date_of_birth,

          cnic_or_bform:
            form.cnic_or_bform.trim(),

          contact_number:
            form.contact_number.trim(),

          address:
            form.address.trim(),

          blood_group:
            form.blood_group,

          emergency_contact:
            form.emergency_contact.trim(),

          photo_url,

          leader_id:
            profile.id,

          status:
            'pending',

          promotion_due:
            false,

          promotion_target:
            null,
        })

      if (insertError) {
        throw insertError
      }

      // ===============================================
      // ACTIVITY LOG
      // ===============================================

      const {
        error: logError,
      } = await supabase
        .from('activity_logs')
        .insert({
          actor_id:
            profile.id,

          action:
            'form_submitted',

          target_table:
            targetTable,

          target_id:
            null,

          details: {
            scout_id:
              newScoutId,

            group:
              targetGroup,

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
        `Scout enrolled successfully. ID: ${newScoutId}`,
        'success'
      )

      setGeneratedId(
        newScoutId
      )
    } catch (error) {
      console.error(
        'Scout form submission error:',
        error
      )

      showAlert(
        error.message ||
        'Something went wrong while saving the form.',
        'error'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div
        className="container"
        style={{
          textAlign: 'center',
          paddingTop: 60,
        }}
      >
        <div className="spinner" />
      </div>
    )
  }

  // =====================================================
  // SUCCESS SCREEN
  // =====================================================

  if (generatedId) {
    return (
      <div
        className="container"
        style={{
          maxWidth: 500,
        }}
      >
        <div
          className="card"
          style={{
            textAlign: 'center',
          }}
        >
          <h2>
            Form submitted 🎉
          </h2>

          <p className="muted">
            The scout form has been saved
            and is waiting for admin review.
          </p>

          <div
            style={{
              margin: '20px 0',
            }}
          >
            <QRCodeCard
              scoutId={generatedId}
              fullName={form.full_name}
              groupCode={liveGroup}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                navigate('/dashboard')
              }
            >
              Back to Dashboard
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setForm(BLANK_FORM)
                setPhotoFile(null)
                setExistingPhotoUrl(null)
                setExistingScoutId('')
                setGeneratedId(null)
              }}
            >
              Enroll Another Scout
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =====================================================
  // FORM
  // =====================================================

  return (
    <div
      className="container"
      style={{
        maxWidth: 640,
      }}
    >
      {/* HEADER */}

      <div className="section-title">
        <h2>
          {isEditMode
            ? revertMode === 'promotion'
              ? 'Re-enter Scout for Promotion'
              : 'Correct Reverted Form'
            : 'New Scout Enrollment'}
        </h2>

        {liveGroup && (
          <span className="pill pill-active">
            {GROUP_LABELS[liveGroup] ||
              liveGroup}
          </span>
        )}
      </div>

      {/* CORRECTION NOTICE */}

      {isEditMode &&
        revertMode === 'correction' && (
          <div
            className="card"
            style={{
              marginBottom: 16,
            }}
          >
            <p style={{ margin: 0 }}>
              This form was returned by the
              admin for correction. Update the
              required information and submit it
              again for admin review.
            </p>

            <p
              className="helper-text"
              style={{
                marginTop: 8,
                marginBottom: 0,
              }}
            >
              The original scout group will be
              retained even if the age changes.
            </p>
          </div>
        )}

      {/* PROMOTION NOTICE */}

      {isEditMode &&
        revertMode === 'promotion' && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              background:
                'var(--amber-bg)',
            }}
          >
            <p style={{ margin: 0 }}>
              This scout is due for promotion
              to{' '}
              <strong>
                {GROUP_LABELS[
                  promotionTargetGroup
                ] ||
                  promotionTargetGroup}
              </strong>
              . Please re-confirm their details
              below.
            </p>
          </div>
        )}

      {/* FORM */}

      <form
        onSubmit={handleSubmit}
        className="card"
      >
        {/* NAME */}

        <div className="grid-2">
          <div className="field">
            <label>
              Full Name
            </label>

            <input
              required
              value={form.full_name}
              onChange={(e) =>
                updateField(
                  'full_name',
                  e.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>
              Father's Name
            </label>

            <input
              required
              value={form.father_name}
              onChange={(e) =>
                updateField(
                  'father_name',
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* DOB + CNIC */}

        <div className="grid-2">
          <div className="field">
            <label>
              Date of Birth
            </label>

            <input
              type="date"
              required
              value={
                form.date_of_birth
              }
              onChange={(e) =>
                updateField(
                  'date_of_birth',
                  e.target.value
                )
              }
            />

            {liveAge !== null && (
              <p className="helper-text">
                Age: {liveAge}
                {' — '}

                {isEditMode &&
                  revertMode === 'correction'
                  ? `Original group: ${GROUP_LABELS[
                  liveGroup
                  ] ||
                  liveGroup ||
                  'Unknown'
                  }`
                  : `Group: ${GROUP_LABELS[
                  groupForAge(
                    liveAge
                  )
                  ] ||
                  'Unknown'
                  }`}
              </p>
            )}
          </div>

          <div className="field">
            <label>
              CNIC / B-Form Number
            </label>

            <input
              required
              value={
                form.cnic_or_bform
              }
              onChange={(e) =>
                updateField(
                  'cnic_or_bform',
                  e.target.value
                )
              }
              placeholder="xxxxx-xxxxxxx-x"
            />
          </div>
        </div>

        {/* CONTACT + BLOOD */}

        <div className="grid-2">
          <div className="field">
            <label>
              Contact Number
            </label>

            <input
              required
              value={
                form.contact_number
              }
              onChange={(e) =>
                updateField(
                  'contact_number',
                  e.target.value
                )
              }
              placeholder="03xx-xxxxxxx"
            />
          </div>

          <div className="field">
            <label>
              Blood Group (optional)
            </label>

            <select
              value={
                form.blood_group
              }
              onChange={(e) =>
                updateField(
                  'blood_group',
                  e.target.value
                )
              }
            >
              <option value="">
                Select
              </option>

              {[
                'A+',
                'A-',
                'B+',
                'B-',
                'AB+',
                'AB-',
                'O+',
                'O-',
                'N/A',
              ].map(
                (bloodGroup) => (
                  <option
                    key={bloodGroup}
                    value={bloodGroup}
                  >
                    {bloodGroup}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* ADDRESS */}

        <div className="field">
          <label>
            Address
          </label>

          <textarea
            required
            value={form.address}
            onChange={(e) =>
              updateField(
                'address',
                e.target.value
              )
            }
          />
        </div>

        {/* EMERGENCY */}

        <div className="field">
          <label>
            Emergency Contact
          </label>

          <input
            required
            value={
              form.emergency_contact
            }
            onChange={(e) =>
              updateField(
                'emergency_contact',
                e.target.value
              )
            }
            placeholder="Name and phone number"
          />
        </div>

        {/* PHOTO */}

        <div className="field">
          <label>
            Photo
          </label>

          <CameraCapture
            onCapture={setPhotoFile}
            existingPreview={
              existingPhotoUrl
            }
          />
        </div>

        {/* ACTION BUTTONS */}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 8,
          }}
        >
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              flex: 1,
            }}
            disabled={
              submitting ||
              deleting
            }
          >
            {submitting
              ? 'Saving…'
              : isEditMode &&
                revertMode ===
                'correction'
                ? 'Submit Corrections'
                : isEditMode &&
                  revertMode ===
                  'promotion'
                  ? 'Submit Promotion'
                  : 'Save & Generate ID Card'}
          </button>

          {/* DELETE IN EDIT MODE */}

          {isEditMode && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={
                submitting ||
                deleting
              }
            >
              {deleting
                ? 'Deleting…'
                : 'Delete Form'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}