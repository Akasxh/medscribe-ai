import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import UserRegistration from './components/UserRegistration.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import './index.css'

const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'))

function LazyFallback() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for SW updates periodically
        setInterval(() => reg.update(), 60 * 60 * 1000)
      })
      .catch((err) => console.warn('SW registration failed:', err))
  })
}

function LoginPage() {
  return <UserRegistration onRegister={(user) => {
    // After registration, redirect based on role
    window.location.href = user.role === 'admin' ? '/admin' : '/'
  }} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="admin">
              <Suspense fallback={<LazyFallback />}>
                <AdminDashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute role="doctor">
              <App />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
