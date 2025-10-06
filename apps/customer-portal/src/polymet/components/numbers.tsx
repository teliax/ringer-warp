import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  PhoneIcon,
  SearchIcon,
  FileTextIcon,
  ClockIcon,
  InfoIcon,
  ArrowRightIcon,
} from "lucide-react";

interface PortingOrder {
  id: string;
  numbers: string[];
  carrier: string;
  status: "draft" | "submitted" | "in-progress" | "completed" | "rejected";
  submittedDate?: string;
  estimatedCompletion?: string;
  progress: number;
}

const mockPortingOrders: PortingOrder[] = [
  {
    id: "PORT-001",
    numbers: ["+1 (555) 123-4567", "+1 (555) 123-4568"],
    carrier: "Verizon Wireless",
    status: "in-progress",
    submittedDate: "2024-01-15",
    estimatedCompletion: "2024-01-22",
    progress: 65,
  },
  {
    id: "PORT-002",
    numbers: ["+1 (555) 987-6543"],
    carrier: "AT&T",
    status: "completed",
    submittedDate: "2024-01-10",
    estimatedCompletion: "2024-01-17",
    progress: 100,
  },
];

export function PortingSection() {
  const [activeStep, setActiveStep] = useState<"check" | "form" | "orders">(
    "check"
  );
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [portabilityResults, setPortabilityResults] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);

  const handlePortabilityCheck = async () => {
    setIsChecking(true);

    // Simulate API call
    setTimeout(() => {
      const numbers = phoneNumbers.split(/[,\s\n]+/).filter((n) => n.trim());
      const results = numbers.map((number) => ({
        number: number.trim(),
        portable: Math.random() > 0.2, // 80% chance of being portable
        carrier: ["Verizon Wireless", "AT&T", "T-Mobile", "Sprint"][
          Math.floor(Math.random() * 4)
        ],

        estimatedDays: Math.floor(Math.random() * 7) + 3,
        type:
          number.includes("800") || number.includes("888")
            ? "Toll-Free"
            : "Local",
      }));

      setPortabilityResults(results);
      setIsChecking(false);
    }, 2000);
  };

  const handleStartPortRequest = () => {
    const portableNumbers = portabilityResults
      .filter((r) => r.portable)
      .map((r) => r.number);
    setSelectedNumbers(portableNumbers);
    setActiveStep("form");
  };

  const getStatusBadge = (status: PortingOrder["status"]) => {
    const variants = {
      draft: { variant: "secondary" as const, color: "bg-gray-500" },
      submitted: {
        variant: "outline" as const,
        color: "border-blue-500 text-blue-500",
      },
      "in-progress": {
        variant: "default" as const,
        color: "bg-[#FBAD18] hover:bg-[#FBAD18]/80",
      },
      completed: {
        variant: "default" as const,
        color: "bg-[#58C5C7] hover:bg-[#58C5C7]/80",
      },
      rejected: { variant: "destructive" as const, color: "" },
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant} className={config.color}>
        {status.replace("-", " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeStep === "check" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveStep("check")}
          className={
            activeStep === "check" ? "bg-[#58C5C7] hover:bg-[#58C5C7]/80" : ""
          }
        >
          Check Portability
        </Button>
        <Button
          variant={activeStep === "form" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveStep("form")}
          className={
            activeStep === "form" ? "bg-[#58C5C7] hover:bg-[#58C5C7]/80" : ""
          }
        >
          Port Request
        </Button>
        <Button
          variant={activeStep === "orders" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveStep("orders")}
          className={
            activeStep === "orders" ? "bg-[#58C5C7] hover:bg-[#58C5C7]/80" : ""
          }
        >
          Porting Orders
        </Button>
      </div>

      {/* Check Portability Step */}
      {activeStep === "check" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <SearchIcon className="w-5 h-5 mr-2" />
                Check Portability
              </CardTitle>
              <CardDescription>
                First, we're going to analyze the phone numbers you provide to
                separate them by losing carrier or RespOrg and determine which
                can be ported when.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone-numbers">Phone numbers</Label>
                <Textarea
                  id="phone-numbers"
                  placeholder="Separate phone numbers with commas or spaces. For example: 3039813633, (919)555-4832, +1.804.555.7213"
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                  className="min-h-[100px]"
                />

                <p className="text-xs text-muted-foreground">
                  Separate phone numbers with commas or spaces. For example:
                  3039813633, (919)555-4832, +1.804.555.7213
                </p>
              </div>

              <Button
                onClick={handlePortabilityCheck}
                disabled={!phoneNumbers.trim() || isChecking}
                className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                {isChecking ? (
                  <>
                    <ClockIcon className="w-4 h-4 mr-2 animate-spin" />
                    Checking Portability...
                  </>
                ) : (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2" />
                    Check Portability
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Portability Results */}
          {portabilityResults.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Portability Results</CardTitle>
                    <CardDescription>
                      {portabilityResults.filter((r) => r.portable).length} of{" "}
                      {portabilityResults.length} numbers are portable
                    </CardDescription>
                  </div>
                  {portabilityResults.some((r) => r.portable) && (
                    <Button
                      onClick={handleStartPortRequest}
                      className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                    >
                      Start Port Request
                      <ArrowRightIcon className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {portabilityResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        result.portable
                          ? "border-green-200 bg-green-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {result.portable ? (
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertTriangleIcon className="w-5 h-5 text-red-600" />
                          )}
                          <div>
                            <div className="font-mono font-medium">
                              {result.number}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {result.carrier} • {result.type}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              result.portable ? "default" : "destructive"
                            }
                          >
                            {result.portable ? "Portable" : "Not Portable"}
                          </Badge>
                          {result.portable && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Est. {result.estimatedDays} business days
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Port Request Form Step */}
      {activeStep === "form" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileTextIcon className="w-5 h-5 mr-2" />
                Port Request Form
              </CardTitle>
              <CardDescription>
                Please provide current account information for each of the
                carriers below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Numbers */}
              <div className="space-y-2">
                <Label>Numbers to Port</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedNumbers.map((number, index) => (
                    <Badge key={index} variant="outline" className="font-mono">
                      {number}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Carrier Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Verizon Wireless - SVR/2 (SPID 6006)
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <InfoIcon className="w-4 h-4 text-blue-600" />

                    <span className="text-sm font-medium text-blue-800">
                      1 PHONE NUMBER
                    </span>
                  </div>
                </div>

                {/* Billing Telephone Number */}
                <div className="space-y-2">
                  <Label htmlFor="btn">Billing Telephone Number (BTN) *</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="btn"
                      placeholder="BTN for the current account"
                      className="flex-1"
                    />

                    <Button variant="outline" size="sm">
                      Check Carrier
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    BTN for the current account
                  </p>
                </div>

                {/* End User Account Information */}
                <div className="space-y-4">
                  <h4 className="font-medium">End User Account Information</h4>

                  <div className="flex space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="business" defaultChecked />

                      <Label
                        htmlFor="business"
                        className="bg-[#58C5C7] text-white px-2 py-1 rounded text-xs"
                      >
                        Business
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="residential" />

                      <Label
                        htmlFor="residential"
                        className="px-2 py-1 rounded text-xs border"
                      >
                        Residential
                      </Label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer-name">Customer name *</Label>
                      <Input id="customer-name" placeholder="Customer name" />

                      <p className="text-xs text-muted-foreground">
                        Max 50 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="auth-person">
                        Person authorizing this port (name on LOA) *
                      </Label>
                      <Input
                        id="auth-person"
                        placeholder="LOA Authorizing Person"
                      />

                      <p className="text-xs text-muted-foreground">
                        Max 15 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-number">Account number *</Label>
                      <Input id="account-number" placeholder="Account number" />

                      <p className="text-xs text-muted-foreground">
                        Max 20 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-pin">Account PIN *</Label>
                      <Input
                        id="account-pin"
                        placeholder="Account PIN"
                        type="password"
                      />

                      <p className="text-xs text-muted-foreground">
                        Max 15 characters
                      </p>
                    </div>
                  </div>
                </div>

                {/* Service Address */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Service Address</h4>
                    <Button variant="link" size="sm" className="text-[#58C5C7]">
                      Show Detailed Form
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="street-number">Street number *</Label>
                      <Input id="street-number" placeholder="Street number" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="street-name">Street name *</Label>
                      <Input id="street-name" placeholder="Street name" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input id="city" placeholder="City" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NY">New York</SelectItem>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP Code *</Label>
                      <Input id="zip" placeholder="ZIP Code" />
                    </div>
                  </div>
                </div>

                {/* Desired Due Date */}
                <div className="space-y-2">
                  <Label htmlFor="due-date">Desired Due Date</Label>
                  <Input id="due-date" type="date" />

                  <p className="text-xs text-muted-foreground">
                    Earliest available date is typically 3-5 business days from
                    submission
                  </p>
                </div>

                {/* Additional Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special instructions or requirements for this port..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Progress: 0 of 1 complete
                </div>
                <div className="flex space-x-3">
                  <Button variant="outline">Start Over</Button>
                  <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                    Continue
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Porting Orders Step */}
      {activeStep === "orders" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <ClockIcon className="w-5 h-5 mr-2" />
                    Porting Orders
                  </CardTitle>
                  <CardDescription>
                    Track the status of your number porting requests
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setActiveStep("check")}
                  className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                >
                  New Port Request
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockPortingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium">{order.id}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.numbers.length} number
                            {order.numbers.length > 1 ? "s" : ""} •{" "}
                            {order.carrier}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {getStatusBadge(order.status)}
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>

                    {order.status === "in-progress" && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{order.progress}%</span>
                        </div>
                        <Progress value={order.progress} className="h-2" />

                        <div className="text-xs text-muted-foreground">
                          Estimated completion: {order.estimatedCompletion}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {order.numbers.map((number, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="font-mono text-xs"
                        >
                          {number}
                        </Badge>
                      ))}
                    </div>

                    {order.submittedDate && (
                      <div className="text-xs text-muted-foreground">
                        Submitted:{" "}
                        {new Date(order.submittedDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Porting Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <InfoIcon className="w-5 h-5 mr-2" />
                Porting Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <InfoIcon className="h-4 w-4" />

                <AlertDescription>
                  <strong>Porting Timeline:</strong> Most number ports complete
                  within 3-7 business days. Complex ports or those requiring
                  additional documentation may take longer.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Required Information</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Current carrier account information</li>
                    <li>• Billing telephone number (BTN)</li>
                    <li>• Account number and PIN/Password</li>
                    <li>• Service address on file</li>
                    <li>• Authorized contact information</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Porting Process</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Submit port request with documentation</li>
                    <li>• Carrier validation and approval</li>
                    <li>• Coordination with losing carrier</li>
                    <li>• Number activation on Ringer network</li>
                    <li>• Service cutover and testing</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
