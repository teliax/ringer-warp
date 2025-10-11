import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthLayout } from "@/polymet/layouts/auth-layout";
import { MainLayout } from "@/polymet/layouts/main-layout";
import { Login } from "@/pages/Login";  // Use our new login page
import { Dashboard } from "@/polymet/pages/dashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CustomerOverview } from "@/polymet/pages/customer-overview";
import { Vendors } from "@/polymet/pages/vendors";
import { Accounting } from "@/polymet/pages/accounting";
import { Support } from "@/polymet/pages/support";

import { ERPManagement } from "@/polymet/pages/erp-management";
import { SupportTickets } from "@/polymet/pages/support-tickets";
import { SupportSearch } from "@/polymet/pages/support-search";
import { SupportAnalysis } from "@/polymet/pages/support-analysis";

export default function TelecomPlatform() {
  return (
    <Router>
      <Routes>
        {/* Authentication Routes */}
        <Route
          path="/login"
          element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          }
        />

        {/* Admin Console Routes - Protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout title="Admin Dashboard">
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <MainLayout title="Admin Dashboard">
              <Dashboard />
            </MainLayout>
          }
        />

        <Route
          path="/customers"
          element={
            <MainLayout title="Customer Management">
              <CustomerOverview />
            </MainLayout>
          }
        />

        <Route
          path="/customer/:customerId"
          element={
            <MainLayout title="Customer Overview">
              <CustomerOverview />
            </MainLayout>
          }
        />

        <Route
          path="/vendors"
          element={
            <MainLayout title="Vendor Management">
              <Vendors />
            </MainLayout>
          }
        />

        <Route
          path="/accounting"
          element={
            <MainLayout title="Accounting">
              <Accounting />
            </MainLayout>
          }
        />

        <Route
          path="/support"
          element={
            <MainLayout title="Support">
              <Support />
            </MainLayout>
          }
        />

        <Route
          path="/erp-management"
          element={
            <MainLayout title="ERP Management">
              <ERPManagement />
            </MainLayout>
          }
        />

        <Route
          path="/support-tickets"
          element={
            <MainLayout title="Support Tickets">
              <SupportTickets />
            </MainLayout>
          }
        />

        <Route
          path="/support-search"
          element={
            <MainLayout title="Support Search">
              <SupportSearch />
            </MainLayout>
          }
        />

        <Route
          path="/support-analysis"
          element={
            <MainLayout title="Support Analysis">
              <SupportAnalysis />
            </MainLayout>
          }
        />
      </Routes>
    </Router>
  );
}
