import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { AuthLayout } from "@/polymet/layouts/auth-layout";
import { MainLayout } from "@/polymet/layouts/main-layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Login } from "@/polymet/pages/login";
import { Dashboard } from "@/polymet/pages/dashboard";
import { Trunks } from "@/polymet/pages/trunks";
import { Numbers } from "@/polymet/pages/numbers";
import { Messaging } from "@/polymet/pages/messaging";
import { Intelligence } from "@/polymet/pages/intelligence";
import { Settings } from "@/polymet/pages/settings";
import { SettingsUsers } from "@/polymet/pages/settings-users";
import { SettingsOAuth } from "@/polymet/pages/settings-oauth";
import { SettingsKYC } from "@/polymet/pages/settings-kyc";
import { Billing } from "@/polymet/pages/billing";
import { Support } from "@/polymet/pages/support";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "sonner";

// Simplified dashboard for demo
function SimpleDashboard({ title }: { title: string }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#231F20]">{title}</h1>
        <p className="text-gray-600">
          Ringer Communications Platform - {title} Section
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-[#231F20]">Feature 1</CardTitle>
            <CardDescription>Core functionality</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">Active</Badge>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-[#231F20]">Feature 2</CardTitle>
            <CardDescription>Advanced tools</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-[#FBAD18] hover:bg-[#FBAD18]/80 text-white">
              Available
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-[#231F20]">Feature 3</CardTitle>
            <CardDescription>Analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="border-gray-300">
              Coming Soon
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <Link to="/">
          <Button
            variant="outline"
            className="border-[#58C5C7] text-[#58C5C7] hover:bg-[#58C5C7] hover:text-white"
          >
            Dashboard
          </Button>
        </Link>
        <Link to="/trunks">
          <Button
            variant="outline"
            className="border-[#58C5C7] text-[#58C5C7] hover:bg-[#58C5C7] hover:text-white"
          >
            SIP Trunks
          </Button>
        </Link>
        <Link to="/numbers">
          <Button
            variant="outline"
            className="border-[#58C5C7] text-[#58C5C7] hover:bg-[#58C5C7] hover:text-white"
          >
            Numbers
          </Button>
        </Link>
        <Link to="/messaging">
          <Button
            variant="outline"
            className="border-[#58C5C7] text-[#58C5C7] hover:bg-[#58C5C7] hover:text-white"
          >
            Messaging
          </Button>
        </Link>
        <Link to="/intelligence">
          <Button
            variant="outline"
            className="border-[#58C5C7] text-[#58C5C7] hover:bg-[#58C5C7] hover:text-white"
          >
            Intelligence
          </Button>
        </Link>

        <Link to="/billing">
          <Button
            variant="outline"
            className="border-[#58C5C7] text-[#58C5C7] hover:bg-[#58C5C7] hover:text-white"
          >
            Billing
          </Button>
        </Link>
        <Link to="/support">
          <Button
            variant="outline"
            className="border-[#58C5C7] text-[#58C5C7] hover:bg-[#58C5C7] hover:text-white"
          >
            Support
          </Button>
        </Link>
        <Link to="/login">
          <Button className="bg-[#FBAD18] hover:bg-[#FBAD18]/80 text-white">
            Login
          </Button>
        </Link>
      </div>
    </div>
  );
}

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

        {/* Main Application Routes */}
        <Route
          path="/"
          element={
            <MainLayout title="Dashboard">
              <Dashboard />
            </MainLayout>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout title="Dashboard">
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/trunks"
          element={
            <MainLayout title="SIP Trunks">
              <Trunks />
            </MainLayout>
          }
        />

        <Route
          path="/numbers"
          element={
            <MainLayout title="Numbers">
              <Numbers />
            </MainLayout>
          }
        />

        <Route
          path="/messaging"
          element={
            <ProtectedRoute>
              <MainLayout title="Messaging">
                <Messaging />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/intelligence"
          element={
            <MainLayout title="Intelligence">
              <Intelligence />
            </MainLayout>
          }
        />

        <Route
          path="/billing"
          element={
            <MainLayout title="Billing">
              <Billing />
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
          path="/settings"
          element={
            <MainLayout title="Settings">
              <Settings />
            </MainLayout>
          }
        />

        <Route
          path="/settings/users"
          element={
            <MainLayout title="User Management">
              <SettingsUsers />
            </MainLayout>
          }
        />

        <Route
          path="/settings/oauth"
          element={
            <MainLayout title="OAuth Tokens">
              <SettingsOAuth />
            </MainLayout>
          }
        />

        <Route
          path="/settings/kyc"
          element={
            <MainLayout title="KYC Information">
              <SettingsKYC />
            </MainLayout>
          }
        />
      </Routes>
      <Toaster position="top-right" richColors />
    </Router>
  );
}
