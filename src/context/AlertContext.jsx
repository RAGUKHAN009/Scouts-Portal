import { createContext, useCallback, useContext, useRef, useState } from 'react'

/*
  Custom alert/toast system.
  This intentionally does NOT use window.alert / window.confirm / console.log
  for user-facing messages. Every notification is rendered as a styled
  popup ("toast") in the top-right corner via the <AlertStack /> component.

  Usage anywhere in the app:
    const { showAlert } = useAlert()
    showAlert('Scout saved successfully', 'success')
    showAlert('Something went wrong', 'error')
*/

const AlertContext = createContext(null)

const ICONS = {
  success: '✅',
  error: '⚠️',
  info: 'ℹ️',
  warning: '⏰',
}

export function AlertProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idCounter = useRef(0)

  const dismissAlert = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showAlert = useCallback(
    (message, type = 'info', duration = 4500) => {
      idCounter.current += 1
      const id = idCounter.current
      setToasts((prev) => [...prev, { id, message, type }])
      if (duration) {
        setTimeout(() => dismissAlert(id), duration)
      }
      return id
    },
    [dismissAlert]
  )

  return (
    <AlertContext.Provider value={{ showAlert, dismissAlert }}>
      {children}
      <div className="alert-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`alert-toast ${t.type}`}>
            <span className="icon">{ICONS[t.type] || ICONS.info}</span>
            <span className="msg">{t.message}</span>
            <button className="close-x" onClick={() => dismissAlert(t.id)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlert must be used inside <AlertProvider>')
  return ctx
}
