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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoIcon, AlertCircle, TrendingUpIcon, DollarSignIcon, ClockIcon } from "lucide-react";
import type { Brand10DLC } from "@/types/messaging";

interface RequestVettingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: Brand10DLC;
  onSubmit: (vettingClass: string) => Promise<void>;
}

export function RequestVettingDialog({
  open,
  onOpenChange,
  brand,
  onSubmit,
}: RequestVettingDialogProps) {
  const [vettingClass, setVettingClass] = useState<string>("STANDARD");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vettingOptions = [
    {
      value: "STANDARD",
      name: "Standard Vetting",
      cost: "$40",
      time: "3-5 business days",
      trustScore: "50-75",
      description: "Manual document review by vetting provider. Suitable for most businesses.",
    },
    {
      value: "ENHANCED",
      name: "Enhanced Vetting",
      cost: "$500",
      time: "5-7 business days",
      trustScore: "75-100",
      description: "Comprehensive background check with premium verification. Highest trust score and throughput.",
    },
  ];

  const selectedOption = vettingOptions.find(opt => opt.value === vettingClass);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(vettingClass);
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Request External Vetting</DialogTitle>
          <DialogDescription>
            Improve your brand's trust score and identity status with professional verification
          </DialogDescription>
        </DialogHeader>

        {/* Why Vetting */}
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Why Request External Vetting?</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Resolve UNVERIFIED identity status</li>
              <li>Increase trust score (50-100)</li>
              <li>Higher message throughput limits</li>
              <li>Faster carrier approvals for campaigns</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Current Status */}
        <div className="bg-gray-50 p-4 rounded-md border">
          <h4 className="font-medium mb-2">Current Brand Status</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Identity Status:</span>{" "}
              <Badge className="ml-2 bg-yellow-100 text-yellow-800">
                {brand.identity_status || "PENDING"}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Trust Score:</span>{" "}
              <span className="font-medium">{brand.trust_score || "Pending"}</span>
            </div>
          </div>
        </div>

        {/* Vetting Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Select Vetting Type</label>
          <Select value={vettingClass} onValueChange={setVettingClass}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vettingOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.name} - {option.cost}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Option Details */}
        {selectedOption && (
          <div className="border rounded-lg p-4 space-y-3 bg-blue-50 border-blue-200">
            <h4 className="font-semibold text-blue-900">{selectedOption.name}</h4>
            <p className="text-sm text-blue-800">{selectedOption.description}</p>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="flex items-center space-x-2">
                <DollarSignIcon className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-blue-700">Cost</p>
                  <p className="font-medium text-blue-900">{selectedOption.cost}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <ClockIcon className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-blue-700">Processing Time</p>
                  <p className="font-medium text-blue-900">{selectedOption.time}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-blue-700">Trust Score</p>
                  <p className="font-medium text-blue-900">{selectedOption.trustScore}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning for business contact */}
        {!brand.business_contact_email && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Business Contact Email Missing</AlertTitle>
            <AlertDescription>
              You must add a business contact email before requesting vetting. Please update your brand information first.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !brand.business_contact_email}
          >
            {isSubmitting ? "Submitting..." : `Request ${selectedOption?.name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
