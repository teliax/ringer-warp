import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface KYCData {
  carrierType: string;
  servicesOffered: string[];
  operatingStates: string[];
  interconnectionAgreements: string;
}

interface TelecomSectionProps {
  kycData: KYCData;
  onInputChange: (field: keyof KYCData, value: string | string[]) => void;
}

const carrierTypes = [
  { value: "clec", label: "Competitive Local Exchange Carrier (CLEC)" },
  { value: "ilec", label: "Incumbent Local Exchange Carrier (ILEC)" },
  { value: "ixc", label: "Interexchange Carrier (IXC)" },
  { value: "wireless", label: "Wireless Carrier" },
  { value: "voip", label: "VoIP Service Provider" },
  { value: "reseller", label: "Reseller" },
  { value: "other", label: "Other" },
];

const serviceTypes = [
  { value: "voice", label: "Voice Services" },
  { value: "messaging", label: "SMS/MMS Messaging" },
  { value: "data", label: "Data Services" },
  { value: "internet", label: "Internet Access" },
  { value: "toll_free", label: "Toll-Free Services" },
  { value: "international", label: "International Services" },
];

const usStates = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export function KYCTelecomSection({
  kycData,
  onInputChange,
}: TelecomSectionProps) {
  const handleServiceChange = (serviceValue: string, checked: boolean) => {
    const services = checked
      ? [...kycData.servicesOffered, serviceValue]
      : kycData.servicesOffered.filter((s) => s !== serviceValue);
    onInputChange("servicesOffered", services);
  };

  const handleStateChange = (stateValue: string, checked: boolean) => {
    const states = checked
      ? [...kycData.operatingStates, stateValue]
      : kycData.operatingStates.filter((s) => s !== stateValue);
    onInputChange("operatingStates", states);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="carrierType">Carrier Type *</Label>
          <Select
            value={kycData.carrierType}
            onValueChange={(value) => onInputChange("carrierType", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select carrier type" />
            </SelectTrigger>
            <SelectContent>
              {carrierTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-1">
          <Label>Services Offered *</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {serviceTypes.map((service) => (
              <div key={service.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`service-${service.value}`}
                  checked={kycData.servicesOffered.includes(service.value)}
                  onChange={(e) =>
                    handleServiceChange(service.value, e.target.checked)
                  }
                  className="rounded"
                />

                <Label htmlFor={`service-${service.value}`} className="text-sm">
                  {service.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <Label>Operating States *</Label>
          <div className="mt-2">
            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded p-3">
              {usStates.map((state) => (
                <div key={state.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`state-${state.value}`}
                    checked={kycData.operatingStates.includes(state.value)}
                    onChange={(e) =>
                      handleStateChange(state.value, e.target.checked)
                    }
                    className="rounded"
                  />

                  <Label htmlFor={`state-${state.value}`} className="text-xs">
                    {state.value}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Select all states where your company provides telecommunications
              services
            </p>
          </div>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="interconnectionAgreements">
            Interconnection Agreements
          </Label>
          <Textarea
            id="interconnectionAgreements"
            value={kycData.interconnectionAgreements}
            onChange={(e) =>
              onInputChange("interconnectionAgreements", e.target.value)
            }
            placeholder="List major interconnection agreements or indicate availability upon request"
            rows={3}
          />

          <p className="text-xs text-muted-foreground mt-1">
            Describe your interconnection agreements with other carriers
          </p>
        </div>
      </div>
    </div>
  );
}
