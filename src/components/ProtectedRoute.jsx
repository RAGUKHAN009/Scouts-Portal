import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requireRole }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (requireRole && profile?.role !== requireRole) {
    return <Navigate to={profile?.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return children
}
