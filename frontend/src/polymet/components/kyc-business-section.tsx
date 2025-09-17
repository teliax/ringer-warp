import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface KYCData {
  yearsInBusiness: string;
  numberOfEmployees: string;
  annualRevenue: string;
  creditRating: string;
  estimatedMonthlyVolume: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;
}

interface BusinessSectionProps {
  kycData: KYCData;
  onInputChange: (field: keyof KYCData, value: string) => void;
}

const revenueRanges = [
  { value: "under_100k", label: "Under $100,000" },
  { value: "100k-500k", label: "$100,000 - $500,000" },
  { value: "500k-1m", label: "$500,000 - $1,000,000" },
  { value: "1m-5m", label: "$1,000,000 - $5,000,000" },
  { value: "5m-10m", label: "$5,000,000 - $10,000,000" },
  { value: "over_10m", label: "Over $10,000,000" },
];

const creditRatings = [
  { value: "excellent", label: "Excellent (750+)" },
  { value: "good", label: "Good (700-749)" },
  { value: "fair", label: "Fair (650-699)" },
  { value: "poor", label: "Poor (Below 650)" },
  { value: "not_established", label: "Not Established" },
];

export function KYCBusinessSection({
  kycData,
  onInputChange,
}: BusinessSectionProps) {
  return (
    <div className="space-y-6">
      {/* Business Metrics */}
      <div>
        <h4 className="text-md font-semibold mb-4">Business Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="yearsInBusiness">Years in Business *</Label>
            <Input
              id="yearsInBusiness"
              value={kycData.yearsInBusiness}
              onChange={(e) => onInputChange("yearsInBusiness", e.target.value)}
              placeholder="2"
              type="number"
              min="0"
            />

            <p className="text-xs text-muted-foreground mt-1">
              Number of years your company has been operating
            </p>
          </div>

          <div>
            <Label htmlFor="numberOfEmployees">Number of Employees *</Label>
            <Input
              id="numberOfEmployees"
              value={kycData.numberOfEmployees}
              onChange={(e) =>
                onInputChange("numberOfEmployees", e.target.value)
              }
              placeholder="25"
              type="number"
              min="1"
            />

            <p className="text-xs text-muted-foreground mt-1">
              Total number of full-time equivalent employees
            </p>
          </div>

          <div>
            <Label htmlFor="annualRevenue">Annual Revenue Range *</Label>
            <Select
              value={kycData.annualRevenue}
              onValueChange={(value) => onInputChange("annualRevenue", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select revenue range" />
              </SelectTrigger>
              <SelectContent>
                {revenueRanges.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="creditRating">Credit Rating</Label>
            <Select
              value={kycData.creditRating}
              onValueChange={(value) => onInputChange("creditRating", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select credit rating" />
              </SelectTrigger>
              <SelectContent>
                {creditRatings.map((rating) => (
                  <SelectItem key={rating.value} value={rating.value}>
                    {rating.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="estimatedMonthlyVolume">
              Estimated Monthly Call/Message Volume *
            </Label>
            <Input
              id="estimatedMonthlyVolume"
              value={kycData.estimatedMonthlyVolume}
              onChange={(e) =>
                onInputChange("estimatedMonthlyVolume", e.target.value)
              }
              placeholder="100,000"
              type="number"
              min="0"
            />

            <p className="text-xs text-muted-foreground mt-1">
              Expected monthly volume of calls and messages combined
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Contact Information */}
      <div className="border-t pt-4">
        <h4 className="text-md font-semibold mb-4">
          Emergency Contact Information
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          Provide 24/7 emergency contact information for service disruptions or
          regulatory inquiries
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="emergencyContactName">
              Emergency Contact Name *
            </Label>
            <Input
              id="emergencyContactName"
              value={kycData.emergencyContactName}
              onChange={(e) =>
                onInputChange("emergencyContactName", e.target.value)
              }
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <Label htmlFor="emergencyContactPhone">Emergency Phone *</Label>
            <Input
              id="emergencyContactPhone"
              value={kycData.emergencyContactPhone}
              onChange={(e) =>
                onInputChange("emergencyContactPhone", e.target.value)
              }
              placeholder="+1 (555) 987-6543"
              type="tel"
            />
          </div>
          <div>
            <Label htmlFor="emergencyContactEmail">Emergency Email *</Label>
            <Input
              id="emergencyContactEmail"
              type="email"
              value={kycData.emergencyContactEmail}
              onChange={(e) =>
                onInputChange("emergencyContactEmail", e.target.value)
              }
              placeholder="emergency@company.com"
            />
          </div>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-amber-600 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-amber-900">
              Business Information Notice
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              This information is used for regulatory compliance, credit
              assessment, and emergency response procedures. All data is
              encrypted and stored in accordance with industry security
              standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
