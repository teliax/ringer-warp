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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  SearchIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  FileTextIcon,
  InfoIcon,
  ArrowRightIcon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react";

interface PortabilityResult {
  number: string;
  portable: boolean;
  carrier: string;
  estimatedDays: number;
  type: "local" | "tollfree";
  respOrg?: string; // For toll-free numbers
  lata?: string; // For local numbers
  ocn?: string; // Operating Company Number
  requiresLoa?: boolean; // Letter of Authorization
}

interface PortingOrder {
  id: string;
  numbers: string[];
  carrier: string;
  respOrg?: string;
  status: "draft" | "submitted" | "in-progress" | "completed" | "rejected";
  submittedDate?: string;
  estimatedCompletion?: string;
  progress: number;
  type: "local" | "tollfree" | "mixed";
}

export function NumberPortingSection() {
  const [activeStep, setActiveStep] = useState<"check" | "form" | "orders">(
    "check"
  );
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [portabilityResults, setPortabilityResults] = useState<
    PortabilityResult[]
  >([]);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [portingType, setPortingType] = useState<
    "local" | "tollfree" | "mixed"
  >("mixed");

  const mockPortingOrders: PortingOrder[] = [
    {
      id: "PORT-001",
      numbers: ["+1 (555) 123-4567", "+1 (555) 123-4568"],
      carrier: "Verizon Wireless",
      status: "in-progress",
      submittedDate: "2024-01-15",
      estimatedCompletion: "2024-01-22",
      progress: 65,
      type: "local",
    },
    {
      id: "PORT-002",
      numbers: ["+1 (800) 555-1234"],
      carrier: "AT&T",
      respOrg: "Somos Inc.",
      status: "completed",
      submittedDate: "2024-01-10",
      estimatedCompletion: "2024-01-17",
      progress: 100,
      type: "tollfree",
    },
    {
      id: "PORT-003",
      numbers: ["+1 (212) 555-9876", "+1 (888) 555-4321"],
      carrier: "Multiple Carriers",
      status: "submitted",
      submittedDate: "2024-01-20",
      estimatedCompletion: "2024-01-27",
      progress: 25,
      type: "mixed",
    },
  ];

  const handlePortabilityCheck = async () => {
    setIsChecking(true);

    // Simulate API call
    setTimeout(() => {
      const numbers = phoneNumbers.split(/[,\s\n]+/).filter((n) => n.trim());
      const results: PortabilityResult[] = numbers.map((number) => {
        const cleanNumber = number.trim();
        const isTollFree =
          /^(\+?1)?[- ]?\(?8[0-9]{2}\)?[- ]?[0-9]{3}[- ]?[0-9]{4}$/.test(
            cleanNumber
          );

        return {
          number: cleanNumber,
          portable: Math.random() > 0.15, // 85% chance of being portable
          carrier: isTollFree
            ? ["AT&T", "Verizon", "T-Mobile", "Bandwidth"][
                Math.floor(Math.random() * 4)
              ]
            : ["Verizon Wireless", "AT&T Mobility", "T-Mobile USA", "Sprint"][
                Math.floor(Math.random() * 4)
              ],

          estimatedDays: isTollFree
            ? Math.floor(Math.random() * 5) + 10 // 10-15 days for toll-free
            : Math.floor(Math.random() * 7) + 3, // 3-10 days for local
          type: isTollFree ? "tollfree" : "local",
          respOrg: isTollFree
            ? ["Somos Inc.", "Neustar", "iconectiv"][
                Math.floor(Math.random() * 3)
              ]
            : undefined,
          lata: !isTollFree
            ? `${Math.floor(Math.random() * 900) + 100}`
            : undefined,
          ocn: `OCN${Math.floor(Math.random() * 9000) + 1000}`,
          requiresLoa: isTollFree || Math.random() > 0.7, // Toll-free always requires LOA, local sometimes
        };
      });

      setPortabilityResults(results);

      // Determine porting type
      const localCount = results.filter((r) => r.type === "local").length;
      const tollFreeCount = results.filter((r) => r.type === "tollfree").length;

      if (localCount > 0 && tollFreeCount > 0) {
        setPortingType("mixed");
      } else if (tollFreeCount > 0) {
        setPortingType("tollfree");
      } else {
        setPortingType("local");
      }

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

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary" as const,
      submitted: "outline" as const,
      "in-progress": "default" as const,
      completed: "default" as const,
      rejected: "destructive" as const,
    };

    const colors = {
      "in-progress": "bg-[#FBAD18] hover:bg-[#FBAD18]/80",
      completed: "bg-[#58C5C7] hover:bg-[#58C5C7]/80",
    };

    return (
      <Badge
        variant={variants[status as keyof typeof variants]}
        className={colors[status as keyof typeof colors] || ""}
      >
        {status.replace("-", " ")}
      </Badge>
    );
  };

  const getTypeIcon = (type: "local" | "tollfree" | "mixed") => {
    switch (type) {
      case "local":
        return <MapPinIcon className="w-4 h-4" />;

      case "tollfree":
        return <PhoneIcon className="w-4 h-4" />;

      case "mixed":
        return (
          <div className="flex space-x-1">
            <MapPinIcon className="w-3 h-3" />

            <PhoneIcon className="w-3 h-3" />
          </div>
        );
    }
  };

  const groupResultsByCarrier = () => {
    const groups: { [key: string]: PortabilityResult[] } = {};

    portabilityResults.forEach((result) => {
      const key =
        result.type === "tollfree"
          ? `${result.respOrg} (Toll-Free)`
          : `${result.carrier} (Local)`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(result);
    });

    return groups;
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
                Check Number Portability
              </CardTitle>
              <CardDescription>
                Analyze phone numbers to determine portability and separate by
                carrier type. Local and toll-free numbers have different porting
                processes and timelines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <MapPinIcon className="w-4 h-4 text-blue-600" />

                    <span className="text-sm font-medium text-blue-800">
                      Local Numbers
                    </span>
                  </div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Geographic numbers (area codes)</li>
                    <li>• 3-10 business days typical</li>
                    <li>• Carrier-specific requirements</li>
                    <li>• May require LOA</li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <PhoneIcon className="w-4 h-4 text-green-600" />

                    <span className="text-sm font-medium text-green-800">
                      Toll-Free Numbers
                    </span>
                  </div>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• 800, 888, 877, 866, etc.</li>
                    <li>• 10-15 business days typical</li>
                    <li>• RespOrg coordination required</li>
                    <li>• Always requires LOA</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-numbers">Phone Numbers</Label>
                <Textarea
                  id="phone-numbers"
                  placeholder="Enter phone numbers separated by commas, spaces, or new lines:&#10;&#10;Local: (212) 555-1234, 415-555-9876&#10;Toll-Free: 800-555-1234, (888) 555-HELP"
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                  className="min-h-[120px]"
                />

                <p className="text-xs text-muted-foreground">
                  Mix local and toll-free numbers - we'll automatically detect
                  and separate them by type
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
                    Analyzing Numbers...
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
                    <CardTitle className="flex items-center space-x-2">
                      <span>Portability Results</span>
                      {getTypeIcon(portingType)}
                    </CardTitle>
                    <CardDescription>
                      {portabilityResults.filter((r) => r.portable).length} of{" "}
                      {portabilityResults.length} numbers are portable •{" "}
                      {portingType === "mixed"
                        ? "Mixed local and toll-free"
                        : portingType === "tollfree"
                          ? "Toll-free numbers"
                          : "Local numbers"}
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
                <div className="space-y-4">
                  {Object.entries(groupResultsByCarrier()).map(
                    ([carrierGroup, results]) => (
                      <div key={carrierGroup} className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground">
                          {carrierGroup}
                        </h4>
                        <div className="space-y-2">
                          {results.map((result, index) => (
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
                                    <div className="font-mono font-medium flex items-center space-x-2">
                                      <span>{result.number}</span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {result.type === "tollfree"
                                          ? "Toll-Free"
                                          : "Local"}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {result.type === "tollfree" ? (
                                        <>
                                          RespOrg: {result.respOrg} • OCN:{" "}
                                          {result.ocn}
                                        </>
                                      ) : (
                                        <>
                                          LATA: {result.lata} • OCN:{" "}
                                          {result.ocn}
                                        </>
                                      )}
                                      {result.requiresLoa && (
                                        <span className="ml-2 text-orange-600">
                                          • LOA Required
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge
                                    variant={
                                      result.portable
                                        ? "default"
                                        : "destructive"
                                    }
                                    className={
                                      result.portable
                                        ? "bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                                        : ""
                                    }
                                  >
                                    {result.portable
                                      ? "Portable"
                                      : "Not Portable"}
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
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Port Request Form Step */}
      {activeStep === "form" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileTextIcon className="w-5 h-5 mr-2" />
              Port Request Form
            </CardTitle>
            <CardDescription>
              Provide account information for each carrier. Requirements differ
              between local and toll-free numbers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selected Numbers Summary */}
            <div className="space-y-2">
              <Label>Numbers to Port</Label>
              <div className="flex flex-wrap gap-2">
                {selectedNumbers.map((number, index) => {
                  const result = portabilityResults.find(
                    (r) => r.number === number
                  );
                  return (
                    <Badge
                      key={index}
                      variant="outline"
                      className="font-mono flex items-center space-x-1"
                    >
                      <span>{number}</span>
                      {result && getTypeIcon(result.type)}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Carrier-specific forms */}
            {Object.entries(groupResultsByCarrier()).map(
              ([carrierGroup, results]) => {
                const portableResults = results.filter(
                  (r) => r.portable && selectedNumbers.includes(r.number)
                );
                if (portableResults.length === 0) return null;

                const isLocalCarrier = portableResults[0].type === "local";

                return (
                  <div key={carrierGroup} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium flex items-center space-x-2">
                        {getTypeIcon(portableResults[0].type)}
                        <span>{carrierGroup}</span>
                      </h3>
                      <Badge variant="secondary">
                        {portableResults.length} number
                        {portableResults.length > 1 ? "s" : ""}
                      </Badge>
                    </div>

                    <div
                      className={`border rounded-lg p-4 ${
                        isLocalCarrier
                          ? "border-blue-200 bg-blue-50"
                          : "border-green-200 bg-green-50"
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-3">
                        <InfoIcon
                          className={`w-4 h-4 ${isLocalCarrier ? "text-blue-600" : "text-green-600"}`}
                        />

                        <span
                          className={`text-sm font-medium ${
                            isLocalCarrier ? "text-blue-800" : "text-green-800"
                          }`}
                        >
                          {isLocalCarrier
                            ? "Local Number Requirements"
                            : "Toll-Free Number Requirements"}
                        </span>
                      </div>
                      <div
                        className={`text-sm ${isLocalCarrier ? "text-blue-700" : "text-green-700"}`}
                      >
                        {portableResults.map((r) => r.number).join(", ")}
                      </div>
                    </div>

                    {/* Form fields based on number type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {isLocalCarrier ? (
                        // Local number form fields
                        <>
                          <div className="space-y-2">
                            <Label>Billing Telephone Number (BTN) *</Label>
                            <Input placeholder="Main billing number for account" />
                          </div>
                          <div className="space-y-2">
                            <Label>Account Holder Name *</Label>
                            <Input placeholder="Name on the account" />
                          </div>
                          <div className="space-y-2">
                            <Label>Account Number *</Label>
                            <Input placeholder="Carrier account number" />
                          </div>
                          <div className="space-y-2">
                            <Label>Account PIN/Password *</Label>
                            <Input
                              type="password"
                              placeholder="Account security PIN"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Service Address</Label>
                            <Input placeholder="Service location address" />
                          </div>
                          <div className="space-y-2">
                            <Label>Authorized Contact</Label>
                            <Input placeholder="Authorized person for port" />
                          </div>
                        </>
                      ) : (
                        // Toll-free number form fields
                        <>
                          <div className="space-y-2">
                            <Label>RespOrg Company *</Label>
                            <Input placeholder="Current responsible organization" />
                          </div>
                          <div className="space-y-2">
                            <Label>Customer Record Name *</Label>
                            <Input placeholder="Name on toll-free record" />
                          </div>
                          <div className="space-y-2">
                            <Label>Contact Name *</Label>
                            <Input placeholder="Authorized contact person" />
                          </div>
                          <div className="space-y-2">
                            <Label>Contact Phone *</Label>
                            <Input placeholder="Contact phone number" />
                          </div>
                          <div className="space-y-2">
                            <Label>Business Address *</Label>
                            <Input placeholder="Business address on record" />
                          </div>
                          <div className="space-y-2">
                            <Label>Tax ID / EIN</Label>
                            <Input placeholder="Federal tax ID number" />
                          </div>
                        </>
                      )}
                    </div>

                    {/* LOA requirement notice */}
                    {portableResults.some((r) => r.requiresLoa) && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <FileTextIcon className="w-4 h-4 text-orange-600" />

                          <span className="text-sm font-medium text-orange-800">
                            Letter of Authorization (LOA) Required
                          </span>
                        </div>
                        <p className="text-sm text-orange-700">
                          {isLocalCarrier
                            ? "This carrier requires a signed LOA for porting. We'll generate one based on your information."
                            : "All toll-free ports require a signed LOA. We'll prepare the necessary documentation."}
                        </p>
                      </div>
                    )}
                  </div>
                );
              }
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Complete all carrier forms to proceed
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveStep("check")}
                >
                  Back to Check
                </Button>
                <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                  Submit Port Request
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Porting Orders Step */}
      {activeStep === "orders" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2" />
                  Porting Orders
                </CardTitle>
                <CardDescription>
                  Track the status of your number porting requests by type
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
                <div key={order.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="font-medium flex items-center space-x-2">
                          <span>{order.id}</span>
                          {getTypeIcon(order.type)}
                          <Badge variant="outline" className="text-xs">
                            {order.type === "mixed"
                              ? "Mixed"
                              : order.type === "tollfree"
                                ? "Toll-Free"
                                : "Local"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.numbers.length} number
                          {order.numbers.length > 1 ? "s" : ""} •{" "}
                          {order.carrier}
                          {order.respOrg && ` • ${order.respOrg}`}
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
      )}
    </div>
  );
}
