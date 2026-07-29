import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'

export default function Navbar() {
  const { profile, isAdmin, signOut } = useAuth()
  const { showAlert } = useAlert()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    showAlert('You have been logged out.', 'info')
    navigate('/login')
  }

  return (
    <header className="navbar">
      <div className="brand">
        <span className="badge-dot">ZG</span>
        IDBS-ZG Scout Portal
      </div>
      <nav>
        {profile && (
          <>
            {isAdmin ? (
              <Link to="/admin">Admin Dashboard</Link>
            ) : (
              <>
                <Link to="/dashboard">New Form</Link>
                <Link to="/reverted">Reverted Forms</Link>
              </>
            )}
            <span className="role-pill">{profile.full_name} · {profile.role}</span>
            <button className="linklike" onClick={handleLogout}>Log out</button>
          </>
        )}
      </nav>
    </header>
  )
}
