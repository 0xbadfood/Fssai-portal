import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { OpsRoute, ProtectedRoute, useAuth } from './lib/auth.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ServicesPage from './pages/services/ServicesPage.jsx'
import ServiceDetailPage from './pages/services/ServiceDetailPage.jsx'

// The dashboard and the ops console load on demand (one chunk each), so the public pages stay light.
const dashboard = () => import('./pages/dashboard/chunk.js')
const ops = () => import('./pages/ops/chunk.js')
const from = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })))
const DashboardLayout = from(dashboard, 'DashboardLayout')
const DashboardHome = from(dashboard, 'DashboardHome')
const DashboardIndex = from(dashboard, 'DashboardIndex')
const ApplyPage = from(dashboard, 'ApplyPage')
const DocumentsPage = from(dashboard, 'DocumentsPage')
const PremisesPage = from(dashboard, 'PremisesPage')
const SupportPage = from(dashboard, 'SupportPage')
const PaymentsPage = from(dashboard, 'PaymentsPage')
const PaymentReturnPage = from(dashboard, 'PaymentReturnPage')
const MyServicesPage = from(dashboard, 'MyServicesPage')
const ServiceCheckoutPage = from(dashboard, 'ServiceCheckoutPage')
const OpsLayout = from(ops, 'OpsLayout')
const OpsQueue = from(ops, 'OpsQueue')
const OpsCasePage = from(ops, 'OpsCasePage')
const ExpertQueue = from(ops, 'ExpertQueue')
const ExpertOrderPage = from(ops, 'ExpertOrderPage')

function Loading() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>
}

// Experts work expert-service orders; ops members and the admin start at the filing queue.
function OpsHome() {
  const { session } = useAuth()
  return session?.role === 'expert' ? <Navigate to="/ops/expert" replace /> : <OpsQueue />
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
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
    </Suspense>
  )
}
