import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'
import CameraCapture from '../components/CameraCapture'
import QRCodeCard from '../components/QRCodeCard'
import { calculateAge, groupForAge, GROUP_LABELS, GROUP_TABLES } from '../utils/ageUtils'
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
  const isEditMode = Boolean(table && id)
  const revertMode = location.state?.mode || 'correction'
  const { profile } = useAuth()
  const { showAlert } = useAlert()

  const promotionTargetGroup = location.state?.targetGroup

  const [form, setForm] = useState(BLANK_FORM)
  const [photoFile, setPhotoFile] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [generatedId, setGeneratedId] = useState(null)

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
          console.error('Error loading existing scout:', error)

          showAlert(
            error.message || 'Could not load this form.',
            'error'
          )

          navigate('/reverted')
          return
        }

        if (!data) {
          showAlert('Scout form was not found.', 'error')
          navigate('/reverted')
          return
        }

        // Fill the form with the existing database information
        setForm({
          full_name: data.full_name || '',
          father_name: data.father_name || '',
          date_of_birth: data.date_of_birth || '',
          cnic_or_bform: data.cnic_or_bform || '',
          contact_number: data.contact_number || '',
          address: data.address || '',
          blood_group: data.blood_group || '',
          emergency_contact: data.emergency_contact || '',
        })

        // Keep the existing photo
        setExistingPhotoUrl(data.photo_url || null)
      } catch (error) {
        console.error('Unexpected error loading form:', error)

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
  }, [isEditMode, table, id])


  const liveAge = calculateAge(form.date_of_birth)
  const liveGroup = revertMode === 'promotion' ? promotionTargetGroup : groupForAge(liveAge)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function uploadPhoto(scoutId) {
    if (!photoFile) return existingPhotoUrl || null
    const ext = photoFile.type?.includes('png') ? 'png' : 'jpg'
    const path = `${scoutId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('scout-photos').upload(path, photoFile, {
      upsert: true,
      contentType: photoFile.type || 'image/jpeg',
    })
    if (error) throw error
    const { data } = supabase.storage.from('scout-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!liveGroup) {
      showAlert('Please enter a valid date of birth.', 'error')
      return
    }
    if (!photoFile && !existingPhotoUrl) {
      showAlert('Please add a photo of the scout.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (isEditMode && revertMode === 'correction') {
        // Same group, same table: just fix the fields and reactivate it
        const photo_url = await uploadPhoto(form.cnic_or_bform || 'scout')
        const { error } = await supabase
          .from(table)
          .update({
            ...form,
            photo_url,
            status: 'active',
            reverted_by: null,
            revert_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
        if (error) throw error

        await supabase.from('activity_logs').insert({
          actor_id: profile.id,
          action: 'form_resubmitted',
          target_table: table,
          target_id: id,
          details: { by: profile.full_name },
        })

        showAlert('Corrections saved. Form is active again.', 'success')
        navigate('/dashboard')
        return
      }

      // Either a brand new enrollment, OR a promotion re-entry into a new
      // group table. Both create a fresh row with a fresh scout ID.
      const targetTable = GROUP_TABLES[liveGroup]
      const newScoutId = await generateScoutId(liveGroup)
      const photo_url = await uploadPhoto(newScoutId)

      const { error: insertError } = await supabase.from(targetTable).insert({
        scout_id: newScoutId,
        ...form,
        photo_url,
        leader_id: profile.id,
        status: 'active',
        promotion_due: false,
        promotion_target: null,
      })
      if (insertError) throw insertError

      if (isEditMode && revertMode === 'promotion') {
        // Archive the old record so it stops showing as active in its old group
        await supabase
          .from(table)
          .update({ status: 'promoted', promotion_due: false })
          .eq('id', id)

        await supabase.from('activity_logs').insert({
          actor_id: profile.id,
          action: 'scout_promoted',
          target_table: targetTable,
          target_id: null,
          details: { from: table, new_scout_id: newScoutId, by: profile.full_name },
        })

        showAlert(`Promotion complete! New ID: ${newScoutId}`, 'success')
      } else {
        showAlert(`Scout enrolled successfully. ID: ${newScoutId}`, 'success')
      }

      setGeneratedId(newScoutId)
    } catch (err) {
      showAlert(err.message || 'Something went wrong while saving the form.', 'error')
    } finally {
      setSubmitting(false)
    }
  }
  async function handleDelete() {
    if (!isEditMode || !table || !id) return

    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this reverted form? This action cannot be undone.'
    )

    if (!confirmed) return

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('leader_id', profile.id)


      if (error) {
        throw error
      }

      showAlert('Form deleted successfully.', 'success')

      navigate('/reverted')


    } catch (error) {
      console.error('Delete form error:', error)


      showAlert(
        error.message || 'Could not delete the form.',
        'error'
      )


    } finally {
      setSubmitting(false)
    }
  }


  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="spinner" />
      </div>
    )
  }

  if (generatedId) {
    return (
      <div className="container" style={{ maxWidth: 500 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>Form submitted 🎉</h2>
          <p className="muted">Here is the scout's ID card. It has been saved to the database.</p>
          <div style={{ margin: '20px 0' }}>
            <QRCodeCard scoutId={generatedId} fullName={form.full_name} groupCode={liveGroup} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setForm(BLANK_FORM)
                setPhotoFile(null)
                setExistingPhotoUrl(null)
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

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="section-title">
        <h2>
          {isEditMode
            ? revertMode === 'promotion'
              ? 'Re-enter Scout for Promotion'
              : 'Correct Reverted Form'
            : 'New Scout Enrollment'}
        </h2>
        {liveGroup && <span className="pill pill-active">{GROUP_LABELS[liveGroup]}</span>}
      </div>

      {revertMode === 'promotion' && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--amber-bg)' }}>
          <p style={{ margin: 0 }}>
            This scout has aged into <strong>{GROUP_LABELS[promotionTargetGroup]}</strong>. Please
            re-confirm their details below to complete the promotion.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="grid-2">
          <div className="field">
            <label>Full Name</label>
            <input
              required
              value={form.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Father's Name</label>
            <input
              required
              value={form.father_name}
              onChange={(e) => updateField('father_name', e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Date of Birth</label>
            <input
              type="date"
              required
              value={form.date_of_birth}
              onChange={(e) => updateField('date_of_birth', e.target.value)}
            />
            {liveAge !== null && (
              <p className="helper-text">
                Age: {liveAge} — will be enrolled as {GROUP_LABELS[groupForAge(liveAge)]}
              </p>
            )}
          </div>
          <div className="field">
            <label>CNIC / B-Form Number</label>
            <input
              required
              value={form.cnic_or_bform}
              onChange={(e) => updateField('cnic_or_bform', e.target.value)}
              placeholder="xxxxx-xxxxxxx-x"
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Contact Number</label>
            <input
              required
              value={form.contact_number}
              onChange={(e) => updateField('contact_number', e.target.value)}
              placeholder="03xx-xxxxxxx"
            />
          </div>
          <div className="field">
            <label>Blood Group (optional)</label>
            <select
              value={form.blood_group}
              onChange={(e) => updateField('blood_group', e.target.value)}
            >
              <option value="">Select</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Address</label>
          <textarea
            required
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
          />
        </div>

        <div className="field">
          <label>Emergency Contact</label>
          <input
            required
            value={form.emergency_contact}
            onChange={(e) => updateField('emergency_contact', e.target.value)}
            placeholder="Name and phone number"
          />
        </div>

        <div className="field">
          <label>Photo</label>
          <CameraCapture onCapture={setPhotoFile} existingPreview={existingPhotoUrl} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8, }} > <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting} > {submitting ? 'Saving…' : 'Save & Generate ID Card'} </button>

          {isEditMode && (
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={submitting} >
              Delete Form
            </button>
          )}

        </div>
      </form>
    </div>
  )
}
