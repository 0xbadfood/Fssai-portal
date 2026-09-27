import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { OpsRoute, ProtectedRoute, useAuth } from './lib/auth.jsx'
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
import PaymentsPage, { PaymentReturnPage } from './pages/dashboard/PaymentsPage.jsx'
import OpsLayout from './pages/ops/OpsLayout.jsx'
import OpsQueue from './pages/ops/OpsQueue.jsx'
import OpsCasePage from './pages/ops/OpsCasePage.jsx'
import { ExpertOrderPage, ExpertQueue } from './pages/ops/ExpertOrders.jsx'
import ServicesPage from './pages/services/ServicesPage.jsx'
import ServiceDetailPage from './pages/services/ServiceDetailPage.jsx'
import { MyServicesPage, ServiceCheckoutPage } from './pages/dashboard/ServiceOrders.jsx'

// Experts work expert-service orders; ops members and the admin start at the filing queue.
function OpsHome() {
  const { session } = useAuth()
  return session?.role === 'expert' ? <Navigate to="/ops/expert" replace /> : <OpsQueue />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/services/:id" element={<ServiceDetailPage />} />

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
        <Route path="payment/return" element={<PaymentReturnPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="services" element={<MyServicesPage />} />
        <Route path="services/:id/pay" element={<ServiceCheckoutPage />} />
        {/* Archived screens (src/archive): old links land on the dashboard. */}
        {['licences', 'notices', 'ai-assistant'].map((p) => (
          <Route key={p} path={p} element={<Navigate to="/dashboard" replace />} />
        ))}
      </Route>

      <Route
        path="/ops"
        element={
          <OpsRoute>
            <OpsLayout />
          </OpsRoute>
        }
      >
        <Route index element={<OpsHome />} />
        <Route path="cases/:id" element={<OpsCasePage />} />
        <Route path="expert" element={<ExpertQueue />} />
        <Route path="orders/:id" element={<ExpertOrderPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
