import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Loader2,
  Mail,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { Brand10DLC } from "@/types/messaging";

interface AuthPlusProgressCardProps {
  brand: Brand10DLC;
  onResend2FA?: () => void;
  onAppeal?: () => void;
  onRequestNew?: () => void;
}

export function AuthPlusProgressCard({
  brand,
  onResend2FA,
  onAppeal,
  onRequestNew,
}: AuthPlusProgressCardProps) {
  const vettingStatus = brand.vetting_status;
  const domainVerified = brand.auth_plus_domain_verified || false;
  const twoFAVerified = brand.auth_plus_2fa_verified || false;
  const emailSent = !!brand.auth_plus_email_sent_at;
  const emailOpened = !!brand.auth_plus_email_opened_at;

  // Calculate days remaining (simplified - actual calculation would use dates)
  const daysRemaining = 7; // Placeholder - would calculate from auth_plus_requested_at
  const pinExpired = daysRemaining <= 0;
  const daysFromRequest = 0; // Placeholder - would calculate from auth_plus_requested_at
  const daysFromFailed = 0; // Placeholder - would calculate from auth_plus_failed_at

  const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      PENDING: "secondary",
      FAILED: "destructive",
      EXPIRED: "outline",
    };
    return variants[status || ""] || "secondary";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Auth+ Verification Status</span>
          {vettingStatus && (
            <Badge variant={getStatusVariant(vettingStatus)} className={
              vettingStatus === "ACTIVE" ? "bg-green-100 text-green-800" :
              vettingStatus === "PENDING" ? "bg-yellow-100 text-yellow-800" :
              vettingStatus === "FAILED" ? "bg-red-100 text-red-800" :
              "bg-gray-100 text-gray-800"
            }>
              {vettingStatus}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Progress Steps */}
        <div className="space-y-4">
          {/* Step 1: Domain Verification */}
          <div className="flex items-center space-x-3">
            {domainVerified ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : vettingStatus === "PENDING" ? (
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            ) : (
              <Circle className="h-5 w-5 text-gray-300" />
            )}
            <div>
              <p className="font-medium">Domain Verification</p>
              <p className="text-sm text-muted-foreground">
                {domainVerified ? "Verified ✓" : vettingStatus === "PENDING" ? "Checking..." : "Pending"}
              </p>
            </div>
          </div>

          {/* Step 2: 2FA Email Sent */}
          <div className="flex items-center space-x-3">
            {emailSent ? (
              <Mail className="h-5 w-5 text-blue-600" />
            ) : (
              <Circle className="h-5 w-5 text-gray-300" />
            )}
            <div>
              <p className="font-medium">2FA Email</p>
              <p className="text-sm text-muted-foreground">
                {emailSent ? `Sent to ${brand.business_contact_email}` : "Pending"}
              </p>
            </div>
          </div>

          {/* Step 3: Business Contact Action */}
          <div className="flex items-center space-x-3">
            {emailOpened ? (
              <Eye className="h-5 w-5 text-purple-600" />
            ) : emailSent ? (
              <Clock className="h-5 w-5 text-yellow-600" />
            ) : (
              <Circle className="h-5 w-5 text-gray-300" />
            )}
            <div>
              <p className="font-medium">Business Contact Action</p>
              <p className="text-sm text-muted-foreground">
                {emailOpened ? "Email opened ✓" :
                 emailSent ? `PIN expires in ${daysRemaining} days` :
                 "Waiting for email"}
              </p>
            </div>
          </div>

          {/* Step 4: 2FA Completion */}
          <div className="flex items-center space-x-3">
            {twoFAVerified ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-gray-300" />
            )}
            <div>
              <p className="font-medium">2FA Verification</p>
              <p className="text-sm text-muted-foreground">
                {twoFAVerified ? "Complete ✓" : "Pending"}
              </p>
            </div>
          </div>
        </div>

        {/* Time-based Actions */}
        <div className="mt-6 space-y-2">
          {vettingStatus === "PENDING" && pinExpired && daysFromRequest < 30 && onResend2FA && (
            <Button variant="outline" onClick={onResend2FA} className="w-full">
              <Mail className="h-4 w-4 mr-2" />
              Resend 2FA Email
            </Button>
          )}

          {vettingStatus === "FAILED" && daysFromFailed < 45 && onAppeal && (
            <Button variant="destructive" onClick={onAppeal} className="w-full">
              <AlertCircle className="h-4 w-4 mr-2" />
              Appeal Decision
            </Button>
          )}

          {(vettingStatus === "FAILED" || vettingStatus === "EXPIRED") && onRequestNew && (
            <Button onClick={onRequestNew} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Request New Verification
            </Button>
          )}
        </div>

        {/* Expiration Warning */}
        {vettingStatus === "PENDING" && daysFromRequest > 20 && (
          <Alert variant="warning" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              2FA must be completed in {30 - daysFromRequest} days or verification will fail.
              Contact your business contact to complete the process.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
