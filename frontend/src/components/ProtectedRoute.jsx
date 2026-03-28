import { Navigate } from 'react-router-dom'

function loadUser() {
  try {
    const raw = localStorage.getItem('medscribe_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function ProtectedRoute({ role, children }) {
  const user = loadUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role && user.role !== role) {
    // Wrong role — redirect to their home
    return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />
  }

  return children
}
