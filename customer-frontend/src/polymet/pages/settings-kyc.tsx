import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheckIcon,
  BuildingIcon,
  UserIcon,
  FileTextIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  SaveIcon,
  UploadIcon,
} from "lucide-react";
import { KYCTelecomSection } from "@/polymet/components/kyc-telecom-section";
import { KYCBusinessSection } from "@/polymet/components/kyc-business-section";

interface KYCData {
  // Company Information
  companyName: string;
  dbaName: string;
  businessType: string;
  incorporationState: string;
  incorporationDate: string;
  fein: string;
  dunsNumber: string;
  naicsCode: string;

  // Address Information
  businessAddress: string;
  businessCity: string;
  businessState: string;
  businessZip: string;
  businessCountry: string;

  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  mailingCountry: string;

  // Contact Information
  primaryContactName: string;
  primaryContactTitle: string;
  primaryContactPhone: string;
  primaryContactEmail: string;

  // Authorized Representative (if different)
  authorizedRepName: string;
  authorizedRepTitle: string;
  authorizedRepPhone: string;
  authorizedRepEmail: string;

  // Regulatory Information
  usfFilerId: string;
  rmdId: string;
  fccRegistrationNumber: string;
  fccFrn: string;
  operatingCompanyNumber: string;
  stateUtilityCommissionId: string;

  // Telecom Specific
  carrierType: string;
  servicesOffered: string[];
  operatingStates: string[];
  interconnectionAgreements: string;

  // Business Details
  businessDescription: string;
  websiteUrl: string;
  estimatedMonthlyVolume: string;
  useCase: string;
  yearsInBusiness: string;
  numberOfEmployees: string;

  // Financial Information
  annualRevenue: string;
  creditRating: string;

  // Emergency Contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;
}

const initialKYCData: KYCData = {
  companyName: "Ringer Communications LLC",
  dbaName: "",
  businessType: "llc",
  incorporationState: "DE",
  incorporationDate: "2023-01-15",
  fein: "12-3456789",
  dunsNumber: "123456789",
  naicsCode: "517311",

  businessAddress: "123 Business Ave",
  businessCity: "Wilmington",
  businessState: "DE",
  businessZip: "19801",
  businessCountry: "US",

  mailingAddress: "123 Business Ave",
  mailingCity: "Wilmington",
  mailingState: "DE",
  mailingZip: "19801",
  mailingCountry: "US",

  primaryContactName: "John Doe",
  primaryContactTitle: "CEO",
  primaryContactPhone: "+1 (555) 123-4567",
  primaryContactEmail: "john@ringer.tel",

  authorizedRepName: "",
  authorizedRepTitle: "",
  authorizedRepPhone: "",
  authorizedRepEmail: "",

  usfFilerId: "USF-12345678",
  rmdId: "RMD-87654321",
  fccRegistrationNumber: "FCC-REG-123456",
  fccFrn: "0012345678",
  operatingCompanyNumber: "OCN-1234",
  stateUtilityCommissionId: "",

  carrierType: "clec",
  servicesOffered: ["voice", "messaging"],
  operatingStates: ["DE", "NY", "CA"],
  interconnectionAgreements: "Available upon request",

  businessDescription:
    "Telecommunications services provider offering voice, messaging, and data solutions for enterprise customers.",
  websiteUrl: "https://ringer.tel",
  estimatedMonthlyVolume: "100000",
  useCase: "enterprise_communications",
  yearsInBusiness: "2",
  numberOfEmployees: "25",

  annualRevenue: "1000000-5000000",
  creditRating: "good",

  emergencyContactName: "Jane Smith",
  emergencyContactPhone: "+1 (555) 987-6543",
  emergencyContactEmail: "emergency@ringer.tel",
};

const businessTypes = [
  { value: "corporation", label: "Corporation" },
  { value: "llc", label: "Limited Liability Company (LLC)" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "non_profit", label: "Non-Profit Organization" },
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
  // Add more states as needed
];

const useCases = [
  { value: "enterprise_communications", label: "Enterprise Communications" },
  { value: "contact_center", label: "Contact Center" },
  { value: "marketing_campaigns", label: "Marketing Campaigns" },
  { value: "customer_notifications", label: "Customer Notifications" },
  { value: "two_factor_auth", label: "Two-Factor Authentication" },
  { value: "other", label: "Other" },
];

// Constants moved to individual section components

export function SettingsKYC() {
  const [kycData, setKycData] = useState<KYCData>(initialKYCData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsBusinessAddress, setSameAsBusinessAddress] = useState(true);

  const handleInputChange = (field: keyof KYCData, value: string) => {
    setKycData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSameAddressToggle = () => {
    setSameAsBusinessAddress(!sameAsBusinessAddress);
    if (!sameAsBusinessAddress) {
      setKycData((prev) => ({
        ...prev,
        mailingAddress: prev.businessAddress,
        mailingCity: prev.businessCity,
        mailingState: prev.businessState,
        mailingZip: prev.businessZip,
        mailingCountry: prev.businessCountry,
      }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    // Show success message
  };

  const kycStatus = "verified"; // Mock status: "pending", "verified", "rejected"

  const getStatusBadge = () => {
    switch (kycStatus) {
      case "verified":
        return (
          <Badge className="bg-green-500 hover:bg-green-500/80">Verified</Badge>
        );

      case "pending":
        return (
          <Badge className="bg-[#FBAD18] hover:bg-[#FBAD18]/80 text-white">
            Pending Review
          </Badge>
        );

      case "rejected":
        return (
          <Badge className="bg-red-500 hover:bg-red-500/80">Rejected</Badge>
        );

      default:
        return <Badge variant="secondary">Not Submitted</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#231F20]">KYC Information</h1>
          <p className="text-gray-600">
            Know Your Customer compliance and business verification details
          </p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Verification Status
            </CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Verified</div>
            <p className="text-xs text-muted-foreground">
              Last updated: Jan 15, 2024
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Compliance Score
            </CardTitle>
            <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98%</div>
            <p className="text-xs text-muted-foreground">
              Excellent compliance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileTextIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">Files uploaded</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BuildingIcon className="mr-2 h-5 w-5" />
            Business Information
          </CardTitle>
          <CardDescription>
            Complete your business details for regulatory compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="company" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="regulatory">Regulatory</TabsTrigger>
              <TabsTrigger value="telecom">Telecom</TabsTrigger>
              <TabsTrigger value="business">Business</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Legal Company Name *</Label>
                  <Input
                    id="companyName"
                    value={kycData.companyName}
                    onChange={(e) =>
                      handleInputChange("companyName", e.target.value)
                    }
                    placeholder="Enter legal company name"
                  />
                </div>
                <div>
                  <Label htmlFor="dbaName">DBA Name (if applicable)</Label>
                  <Input
                    id="dbaName"
                    value={kycData.dbaName}
                    onChange={(e) =>
                      handleInputChange("dbaName", e.target.value)
                    }
                    placeholder="Doing Business As name"
                  />
                </div>
                <div>
                  <Label htmlFor="businessType">Business Type *</Label>
                  <Select
                    value={kycData.businessType}
                    onValueChange={(value) =>
                      handleInputChange("businessType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="incorporationState">
                    State of Incorporation *
                  </Label>
                  <Select
                    value={kycData.incorporationState}
                    onValueChange={(value) =>
                      handleInputChange("incorporationState", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {usStates.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="incorporationDate">
                    Incorporation Date *
                  </Label>
                  <Input
                    id="incorporationDate"
                    type="date"
                    value={kycData.incorporationDate}
                    onChange={(e) =>
                      handleInputChange("incorporationDate", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="fein">Federal EIN (FEIN) *</Label>
                  <Input
                    id="fein"
                    value={kycData.fein}
                    onChange={(e) => handleInputChange("fein", e.target.value)}
                    placeholder="XX-XXXXXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="dunsNumber">DUNS Number</Label>
                  <Input
                    id="dunsNumber"
                    value={kycData.dunsNumber}
                    onChange={(e) =>
                      handleInputChange("dunsNumber", e.target.value)
                    }
                    placeholder="123456789"
                  />

                  <p className="text-xs text-muted-foreground mt-1">
                    Data Universal Numbering System
                  </p>
                </div>
                <div>
                  <Label htmlFor="naicsCode">NAICS Code *</Label>
                  <Input
                    id="naicsCode"
                    value={kycData.naicsCode}
                    onChange={(e) =>
                      handleInputChange("naicsCode", e.target.value)
                    }
                    placeholder="517311"
                  />

                  <p className="text-xs text-muted-foreground mt-1">
                    North American Industry Classification System
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">Business Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="businessAddress">Street Address *</Label>
                    <Input
                      id="businessAddress"
                      value={kycData.businessAddress}
                      onChange={(e) =>
                        handleInputChange("businessAddress", e.target.value)
                      }
                      placeholder="123 Business Street"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessCity">City *</Label>
                    <Input
                      id="businessCity"
                      value={kycData.businessCity}
                      onChange={(e) =>
                        handleInputChange("businessCity", e.target.value)
                      }
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessState">State *</Label>
                    <Select
                      value={kycData.businessState}
                      onValueChange={(value) =>
                        handleInputChange("businessState", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {usStates.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="businessZip">ZIP Code *</Label>
                    <Input
                      id="businessZip"
                      value={kycData.businessZip}
                      onChange={(e) =>
                        handleInputChange("businessZip", e.target.value)
                      }
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessCountry">Country *</Label>
                    <Select
                      value={kycData.businessCountry}
                      onValueChange={(value) =>
                        handleInputChange("businessCountry", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    id="sameAddress"
                    checked={sameAsBusinessAddress}
                    onChange={handleSameAddressToggle}
                    className="rounded"
                  />

                  <Label htmlFor="sameAddress">
                    Mailing address is the same as business address
                  </Label>
                </div>

                {!sameAsBusinessAddress && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Mailing Address
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="mailingAddress">Street Address *</Label>
                        <Input
                          id="mailingAddress"
                          value={kycData.mailingAddress}
                          onChange={(e) =>
                            handleInputChange("mailingAddress", e.target.value)
                          }
                          placeholder="123 Mailing Street"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mailingCity">City *</Label>
                        <Input
                          id="mailingCity"
                          value={kycData.mailingCity}
                          onChange={(e) =>
                            handleInputChange("mailingCity", e.target.value)
                          }
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mailingState">State *</Label>
                        <Select
                          value={kycData.mailingState}
                          onValueChange={(value) =>
                            handleInputChange("mailingState", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {usStates.map((state) => (
                              <SelectItem key={state.value} value={state.value}>
                                {state.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="mailingZip">ZIP Code *</Label>
                        <Input
                          id="mailingZip"
                          value={kycData.mailingZip}
                          onChange={(e) =>
                            handleInputChange("mailingZip", e.target.value)
                          }
                          placeholder="12345"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mailingCountry">Country *</Label>
                        <Select
                          value={kycData.mailingCountry}
                          onValueChange={(value) =>
                            handleInputChange("mailingCountry", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="US">United States</SelectItem>
                            <SelectItem value="CA">Canada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryContactName">
                    Primary Contact Name *
                  </Label>
                  <Input
                    id="primaryContactName"
                    value={kycData.primaryContactName}
                    onChange={(e) =>
                      handleInputChange("primaryContactName", e.target.value)
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="primaryContactTitle">Title *</Label>
                  <Input
                    id="primaryContactTitle"
                    value={kycData.primaryContactTitle}
                    onChange={(e) =>
                      handleInputChange("primaryContactTitle", e.target.value)
                    }
                    placeholder="CEO, CTO, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="primaryContactPhone">Phone Number *</Label>
                  <Input
                    id="primaryContactPhone"
                    value={kycData.primaryContactPhone}
                    onChange={(e) =>
                      handleInputChange("primaryContactPhone", e.target.value)
                    }
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="primaryContactEmail">Email Address *</Label>
                  <Input
                    id="primaryContactEmail"
                    type="email"
                    value={kycData.primaryContactEmail}
                    onChange={(e) =>
                      handleInputChange("primaryContactEmail", e.target.value)
                    }
                    placeholder="contact@company.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="websiteUrl">Company Website</Label>
                  <Input
                    id="websiteUrl"
                    value={kycData.websiteUrl}
                    onChange={(e) =>
                      handleInputChange("websiteUrl", e.target.value)
                    }
                    placeholder="https://www.company.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="businessDescription">
                    Business Description *
                  </Label>
                  <Textarea
                    id="businessDescription"
                    value={kycData.businessDescription}
                    onChange={(e) =>
                      handleInputChange("businessDescription", e.target.value)
                    }
                    placeholder="Describe your business activities and services"
                    rows={3}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-md font-semibold mb-4">
                  Authorized Representative (if different from primary contact)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="authorizedRepName">
                      Authorized Representative Name
                    </Label>
                    <Input
                      id="authorizedRepName"
                      value={kycData.authorizedRepName}
                      onChange={(e) =>
                        handleInputChange("authorizedRepName", e.target.value)
                      }
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <Label htmlFor="authorizedRepTitle">Title</Label>
                    <Input
                      id="authorizedRepTitle"
                      value={kycData.authorizedRepTitle}
                      onChange={(e) =>
                        handleInputChange("authorizedRepTitle", e.target.value)
                      }
                      placeholder="VP of Operations"
                    />
                  </div>
                  <div>
                    <Label htmlFor="authorizedRepPhone">Phone Number</Label>
                    <Input
                      id="authorizedRepPhone"
                      value={kycData.authorizedRepPhone}
                      onChange={(e) =>
                        handleInputChange("authorizedRepPhone", e.target.value)
                      }
                      placeholder="+1 (555) 987-6543"
                    />
                  </div>
                  <div>
                    <Label htmlFor="authorizedRepEmail">Email Address</Label>
                    <Input
                      id="authorizedRepEmail"
                      type="email"
                      value={kycData.authorizedRepEmail}
                      onChange={(e) =>
                        handleInputChange("authorizedRepEmail", e.target.value)
                      }
                      placeholder="authorized@company.com"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="regulatory" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="usfFilerId">USF Filer ID</Label>
                  <Input
                    id="usfFilerId"
                    value={kycData.usfFilerId}
                    onChange={(e) =>
                      handleInputChange("usfFilerId", e.target.value)
                    }
                    placeholder="USF-12345678"
                  />

                  <p className="text-xs text-muted-foreground mt-1">
                    Universal Service Fund Filer ID
                  </p>
                </div>
                <div>
                  <Label htmlFor="rmdId">RMD ID</Label>
                  <Input
                    id="rmdId"
                    value={kycData.rmdId}
                    onChange={(e) => handleInputChange("rmdId", e.target.value)}
                    placeholder="RMD-87654321"
                  />

                  <p className="text-xs text-muted-foreground mt-1">
                    Robocall Mitigation Database ID
                  </p>
                </div>
                <div>
                  <Label htmlFor="fccRegistrationNumber">
                    FCC Registration Number
                  </Label>
                  <Input
                    id="fccRegistrationNumber"
                    value={kycData.fccRegistrationNumber}
                    onChange={(e) =>
                      handleInputChange("fccRegistrationNumber", e.target.value)
                    }
                    placeholder="FCC-REG-123456"
                  />
                </div>
                <div>
                  <Label htmlFor="fccFrn">
                    FCC FRN (FCC Registration Number)
                  </Label>
                  <Input
                    id="fccFrn"
                    value={kycData.fccFrn}
                    onChange={(e) =>
                      handleInputChange("fccFrn", e.target.value)
                    }
                    placeholder="0012345678"
                  />

                  <p className="text-xs text-muted-foreground mt-1">
                    10-digit FCC Registration Number
                  </p>
                </div>
                <div>
                  <Label htmlFor="operatingCompanyNumber">
                    Operating Company Number (OCN)
                  </Label>
                  <Input
                    id="operatingCompanyNumber"
                    value={kycData.operatingCompanyNumber}
                    onChange={(e) =>
                      handleInputChange(
                        "operatingCompanyNumber",
                        e.target.value
                      )
                    }
                    placeholder="OCN-1234"
                  />
                </div>
                <div>
                  <Label htmlFor="stateUtilityCommissionId">
                    State Utility Commission ID
                  </Label>
                  <Input
                    id="stateUtilityCommissionId"
                    value={kycData.stateUtilityCommissionId}
                    onChange={(e) =>
                      handleInputChange(
                        "stateUtilityCommissionId",
                        e.target.value
                      )
                    }
                    placeholder="State-specific utility ID"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedMonthlyVolume">
                    Estimated Monthly Volume
                  </Label>
                  <Input
                    id="estimatedMonthlyVolume"
                    value={kycData.estimatedMonthlyVolume}
                    onChange={(e) =>
                      handleInputChange(
                        "estimatedMonthlyVolume",
                        e.target.value
                      )
                    }
                    placeholder="Number of calls/messages per month"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="useCase">Primary Use Case *</Label>
                  <Select
                    value={kycData.useCase}
                    onValueChange={(value) =>
                      handleInputChange("useCase", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary use case" />
                    </SelectTrigger>
                    <SelectContent>
                      {useCases.map((useCase) => (
                        <SelectItem key={useCase.value} value={useCase.value}>
                          {useCase.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="telecom" className="space-y-4">
              <KYCTelecomSection
                kycData={{
                  carrierType: kycData.carrierType,
                  servicesOffered: kycData.servicesOffered,
                  operatingStates: kycData.operatingStates,
                  interconnectionAgreements: kycData.interconnectionAgreements,
                }}
                onInputChange={(field, value) => {
                  if (
                    field === "servicesOffered" ||
                    field === "operatingStates"
                  ) {
                    setKycData((prev) => ({ ...prev, [field]: value }));
                  } else {
                    handleInputChange(field, value as string);
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="business" className="space-y-4">
              <KYCBusinessSection
                kycData={{
                  yearsInBusiness: kycData.yearsInBusiness,
                  numberOfEmployees: kycData.numberOfEmployees,
                  annualRevenue: kycData.annualRevenue,
                  creditRating: kycData.creditRating,
                  estimatedMonthlyVolume: kycData.estimatedMonthlyVolume,
                  emergencyContactName: kycData.emergencyContactName,
                  emergencyContactPhone: kycData.emergencyContactPhone,
                  emergencyContactEmail: kycData.emergencyContactEmail,
                }}
                onInputChange={handleInputChange}
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-4 mt-6 pt-6 border-t">
            <Button variant="outline">
              <UploadIcon className="w-4 h-4 mr-2" />
              Upload Documents
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
            >
              {isSubmitting ? (
                "Saving..."
              ) : (
                <>
                  <SaveIcon className="w-4 h-4 mr-2" />
                  Save KYC Information
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 border rounded-lg bg-blue-50">
        <div className="flex items-start space-x-3">
          <AlertTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5" />

          <div>
            <h3 className="font-semibold text-blue-900">
              Enhanced KYC Compliance Requirements
            </h3>
            <p className="text-sm text-blue-800 mt-1">
              This comprehensive KYC form includes all FCC-required information
              including company details, regulatory IDs (FEIN, USF Filer ID, RMD
              ID), carrier classification, service offerings, and emergency
              contact information. All fields marked with * are required for
              regulatory compliance. Your information is encrypted and stored
              securely in accordance with industry standards and
              telecommunications regulations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
