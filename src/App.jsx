import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './lib/auth.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import DashboardLayout from './components/dashboard/DashboardLayout.jsx'
import DashboardHome from './pages/dashboard/DashboardHome.jsx'
import DashboardIndex from './pages/dashboard/DashboardIndex.jsx'
import ApplyPage from './pages/dashboard/apply/ApplyPage.jsx'
import DocumentsPage from './pages/dashboard/DocumentsPage.jsx'
import PremisesPage from './pages/dashboard/PremisesPage.jsx'
import SupportPage from './pages/dashboard/SupportPage.jsx'
import PaymentsPage from './pages/dashboard/PaymentsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardIndex />} />
        <Route path="apply" element={<ApplyPage />} />
        <Route path="overview" element={<DashboardHome />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="premises" element={<PremisesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="support" element={<SupportPage />} />
        {/* Archived screens (src/archive): old links land on the dashboard. */}
        {['licences', 'notices', 'ai-assistant'].map((p) => (
          <Route key={p} path={p} element={<Navigate to="/dashboard" replace />} />
        ))}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
