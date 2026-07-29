import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AlertProvider } from './context/AlertContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import LeaderDashboard from './pages/LeaderDashboard'
import ScoutForm from './pages/ScoutForm'
import RevertedForms from './pages/RevertedForms'
import AdminDashboard from './pages/AdminDashboard'
import ScoutDetail from './pages/ScoutDetail'

function HomeRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={profile?.role === 'admin' ? '/admin' : '/dashboard'} replace />
}

export default function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="page">
            <Navbar />
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<Login />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireRole="leader">
                    <LeaderDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/scout/:table/:id"
                element={
                  <ProtectedRoute requireRole="leader">
                    <ScoutDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/new"
                element={
                  <ProtectedRoute requireRole="leader">
                    <ScoutForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/edit/:table/:id"
                element={
                  <ProtectedRoute requireRole="leader">
                    <ScoutForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reverted"
                element={
                  <ProtectedRoute requireRole="leader">
                    <RevertedForms />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/scout/:table/:id"
                element={
                  <ProtectedRoute requireRole="admin">
                    <ScoutDetail />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </AlertProvider>
  )
}
