import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAlert } from '../context/AlertContext'

export function useScoutActions() {
    const navigate = useNavigate()
    const { showAlert } = useAlert()

    const [deleting, setDeleting] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // ==========================================
    // DELETE SCOUT FORM
    // ==========================================

    async function handleDelete(table, id, scoutName = 'this scout') {
        if (!table || !id) return false

        const confirmed = window.confirm(
            `Are you sure you want to permanently delete ${scoutName}'s form?\n\nThis action cannot be undone.`
        )

        if (!confirmed) return false

        setDeleting(true)

        try {
            const { data, error } = await supabase
                .from(table)
                .delete()
                .eq('id', id)
                .select()

            if (error) {
                console.error('DELETE ERROR:', error)
                throw error
            }

            if (!data || data.length === 0) {
                showAlert(
                    'The form was not deleted. You may not have permission to delete this record.',
                    'error'
                )

                return false
            }

            showAlert(
                'Scout form deleted successfully.',
                'success'
            )

            navigate('/dashboard')

            return true
        } catch (error) {
            console.error('Delete scout error:', error)

            showAlert(
                error.message || 'Could not delete the scout form.',
                'error'
            )

            return false
        } finally {
            setDeleting(false)
        }
    }

    return {
        handleDelete,
        deleting,
        submitting,
        setSubmitting,
    }
}