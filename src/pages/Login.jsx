import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAlert } from '../context/AlertContext'

export default function Login() {
  const { signIn } = useAuth()
  const { showAlert } = useAlert()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)

    if (error) {
      showAlert(error.message || 'Login failed. Check your email and password.', 'error')
      return
    }

    showAlert('Welcome back!', 'success')
    navigate('/dashboard')
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-emblem">ZG</div>
        <h2>IDBS-ZG Scout Portal</h2>
        <p className="muted" style={{ marginBottom: 24, fontSize: '0.9rem' }}>
          Ismaili District Boy Scouts Group · Zulfiqarabad
        </p>

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="leader@example.com"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Log In'}
          </button>
        </form>
        <p className="helper-text" style={{ marginTop: 18 }}>
          Accounts are created by the admin. Contact your group admin if you don't have login
          details yet.
        </p>
      </div>
    </div>
  )
}
