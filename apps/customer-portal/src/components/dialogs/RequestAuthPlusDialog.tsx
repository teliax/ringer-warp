import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, InfoIcon } from "lucide-react";
import type { Brand10DLC } from "@/types/messaging";

interface RequestAuthPlusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: Brand10DLC;
  onSubmit: () => Promise<void>;
}

export function RequestAuthPlusDialog({
  open,
  onOpenChange,
  brand,
  onSubmit,
}: RequestAuthPlusDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit();
      onOpenChange(false);
    } catch (error) {
      // Error handling done by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Auth+ Verification</DialogTitle>
          <DialogDescription>
            Two-factor authentication to prevent brand impersonation
          </DialogDescription>
        </DialogHeader>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
          <h4 className="font-medium mb-2">What happens next?</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>✅ Domain verification (instant)</li>
            <li>📧 2FA email sent to: <strong>{brand.business_contact_email || "business contact"}</strong></li>
            <li>⏱️ Business contact has 7 days to complete (30 days max)</li>
            <li>✅ Auth+ status becomes ACTIVE</li>
          </ol>
        </div>

        {/* Business Contact Verification */}
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Business Contact Email</AlertTitle>
          <AlertDescription>
            2FA email will be sent to: <strong>{brand.business_contact_email}</strong>
            <br />
            Make sure this person can access their email and complete verification.
          </AlertDescription>
        </Alert>

        {/* Estimated Time */}
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Estimated time: 30 seconds - 7 days</span>
        </div>

        {/* Actions */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Request Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
