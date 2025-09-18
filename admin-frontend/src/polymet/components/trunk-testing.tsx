import React, { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  PlayIcon,
  ShapesIcon as StopIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PhoneIcon,
  RouteIcon,
  CalculatorIcon,
  AlertCircleIcon,
} from "lucide-react";
import { type SipTrunk } from "@/polymet/data/trunk-mock-data";

interface TestResult {
  id: string;
  type: "options" | "call" | "route" | "rate";
  status: "running" | "success" | "failed" | "timeout";
  startTime: string;
  endTime?: string;
  duration?: number;
  details: any;
}

interface TrunkTestingProps {
  trunk?: SipTrunk | null;
  onTestComplete?: (result: TestResult) => void;
}

const mockTestResults: TestResult[] = [
  {
    id: "test-001",
    type: "options",
    status: "success",
    startTime: "2024-01-20T10:30:00Z",
    endTime: "2024-01-20T10:30:02Z",
    duration: 2000,
    details: {
      responseCode: 200,
      responseTime: 150,
      userAgent: "Asterisk PBX 18.0.0",
      allow: ["INVITE", "ACK", "CANCEL", "BYE", "OPTIONS"],
    },
  },
  {
    id: "test-002",
    type: "call",
    status: "success",
    startTime: "2024-01-20T10:25:00Z",
    endTime: "2024-01-20T10:25:15Z",
    duration: 15000,
    details: {
      calledNumber: "+15551234567",
      responseCode: 200,
      pdd: 2300,
      callDuration: 10000,
      hangupCause: "NORMAL_CLEARING",
    },
  },
  {
    id: "test-003",
    type: "route",
    status: "failed",
    startTime: "2024-01-20T10:20:00Z",
    endTime: "2024-01-20T10:20:05Z",
    duration: 5000,
    details: {
      destination: "+442071234567",
      error: "No route found for destination",
      triedRoutes: ["Route-UK-Premium", "Route-UK-Standard"],
    },
  },
];

export function TrunkTesting({ trunk, onTestComplete }: TrunkTestingProps) {
  const [testResults, setTestResults] = useState<TestResult[]>(mockTestResults);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testType, setTestType] = useState<
    "options" | "call" | "route" | "rate"
  >("options");
  const [testParams, setTestParams] = useState({
    destination: "",
    duration: 10,
    codec: "G.711u",
    callerID: "",
  });

  const runTest = async (type: "options" | "call" | "route" | "rate") => {
    setIsTestRunning(true);

    const testId = `test-${Date.now()}`;
    const newTest: TestResult = {
      id: testId,
      type,
      status: "running",
      startTime: new Date().toISOString(),
      details: {},
    };

    setTestResults([newTest, ...testResults]);

    // Simulate test execution
    setTimeout(
      () => {
        const completedTest: TestResult = {
          ...newTest,
          status: Math.random() > 0.2 ? "success" : "failed",
          endTime: new Date().toISOString(),
          duration: Math.floor(Math.random() * 10000) + 1000,
          details: generateTestDetails(type),
        };

        setTestResults((prev) =>
          prev.map((t) => (t.id === testId ? completedTest : t))
        );
        setIsTestRunning(false);
        onTestComplete?.(completedTest);
      },
      Math.floor(Math.random() * 5000) + 2000
    );
  };

  const generateTestDetails = (type: string) => {
    switch (type) {
      case "options":
        return {
          responseCode: 200,
          responseTime: Math.floor(Math.random() * 500) + 50,
          userAgent: "Asterisk PBX 18.0.0",
          allow: ["INVITE", "ACK", "CANCEL", "BYE", "OPTIONS"],
        };
      case "call":
        return {
          calledNumber: testParams.destination || "+15551234567",
          responseCode: 200,
          pdd: Math.floor(Math.random() * 3000) + 1000,
          callDuration: testParams.duration * 1000,
          hangupCause: "NORMAL_CLEARING",
        };
      case "route":
        return {
          destination: testParams.destination || "+442071234567",
          selectedRoute: "Route-UK-Premium",
          cost: "$0.0045/min",
          quality: "Premium",
        };
      case "rate":
        return {
          destination: testParams.destination || "+15551234567",
          zone: "INTERSTATE",
          rate: "$0.0095/min",
          billingIncrement: 60,
          minimumDuration: 60,
        };
      default:
        return {};
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <RefreshCwIcon className="w-4 h-4 animate-spin text-blue-600" />;

      case "success":
        return <CheckCircleIcon className="w-4 h-4 text-green-600" />;

      case "failed":
        return <XCircleIcon className="w-4 h-4 text-red-600" />;

      case "timeout":
        return <ClockIcon className="w-4 h-4 text-yellow-600" />;

      default:
        return <AlertCircleIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-blue-100 text-blue-800";
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "timeout":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "options":
        return <RefreshCwIcon className="w-4 h-4" />;

      case "call":
        return <PhoneIcon className="w-4 h-4" />;

      case "route":
        return <RouteIcon className="w-4 h-4" />;

      case "rate":
        return <CalculatorIcon className="w-4 h-4" />;

      default:
        return <AlertCircleIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayIcon className="w-5 h-5" />
            Trunk Testing & Validation Tools
          </CardTitle>
          <CardDescription>
            Test trunk connectivity, call routing, and rate calculation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="quick-tests" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick-tests">Quick Tests</TabsTrigger>
              <TabsTrigger value="advanced-tests">Advanced Tests</TabsTrigger>
              <TabsTrigger value="test-history">Test History</TabsTrigger>
            </TabsList>

            <TabsContent value="quick-tests" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <RefreshCwIcon className="w-5 h-5" />
                      SIP OPTIONS
                    </CardTitle>
                    <CardDescription>Test trunk connectivity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => runTest("options")}
                      disabled={isTestRunning}
                      className="w-full"
                    >
                      {isTestRunning ? (
                        <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <PlayIcon className="w-4 h-4 mr-2" />
                      )}
                      Ping Trunk
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PhoneIcon className="w-5 h-5" />
                      Test Call
                    </CardTitle>
                    <CardDescription>Execute test call</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog
                      open={testDialogOpen}
                      onOpenChange={setTestDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => {
                            setTestType("call");
                            setTestDialogOpen(true);
                          }}
                          disabled={isTestRunning}
                          className="w-full"
                        >
                          <PhoneIcon className="w-4 h-4 mr-2" />
                          Test Call
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Configure Test Call</DialogTitle>
                          <DialogDescription>
                            Set parameters for the test call
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="test-destination">
                              Destination Number
                            </Label>
                            <Input
                              id="test-destination"
                              value={testParams.destination}
                              onChange={(e) =>
                                setTestParams({
                                  ...testParams,
                                  destination: e.target.value,
                                })
                              }
                              placeholder="+15551234567"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="test-duration">
                              Call Duration (seconds)
                            </Label>
                            <Input
                              id="test-duration"
                              type="number"
                              value={testParams.duration}
                              onChange={(e) =>
                                setTestParams({
                                  ...testParams,
                                  duration: parseInt(e.target.value) || 10,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="test-codec">Preferred Codec</Label>
                            <Select
                              value={testParams.codec}
                              onValueChange={(value) =>
                                setTestParams({ ...testParams, codec: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="G.711u">
                                  G.711μ (PCMU)
                                </SelectItem>
                                <SelectItem value="G.711a">
                                  G.711a (PCMA)
                                </SelectItem>
                                <SelectItem value="G.729">G.729</SelectItem>
                                <SelectItem value="G.722">
                                  G.722 (HD)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setTestDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              runTest("call");
                              setTestDialogOpen(false);
                            }}
                          >
                            Start Test Call
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <RouteIcon className="w-5 h-5" />
                      Route Test
                    </CardTitle>
                    <CardDescription>Test call routing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => runTest("route")}
                      disabled={isTestRunning}
                      className="w-full"
                    >
                      <RouteIcon className="w-4 h-4 mr-2" />
                      Test Route
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalculatorIcon className="w-5 h-5" />
                      Rate Test
                    </CardTitle>
                    <CardDescription>Calculate call rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => runTest("rate")}
                      disabled={isTestRunning}
                      className="w-full"
                    >
                      <CalculatorIcon className="w-4 h-4 mr-2" />
                      Test Rates
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {isTestRunning && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Test in Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Running test...</span>
                        <RefreshCwIcon className="w-4 h-4 animate-spin" />
                      </div>
                      <Progress value={65} className="w-full" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="advanced-tests" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Advanced Test Scenarios
                  </CardTitle>
                  <CardDescription>
                    Configure complex test scenarios and batch operations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Load Testing</h4>
                      <div className="space-y-2">
                        <Label htmlFor="concurrent-calls">
                          Concurrent Calls
                        </Label>
                        <Input
                          id="concurrent-calls"
                          type="number"
                          placeholder="10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="test-duration-advanced">
                          Test Duration (minutes)
                        </Label>
                        <Input
                          id="test-duration-advanced"
                          type="number"
                          placeholder="5"
                        />
                      </div>
                      <Button className="w-full">
                        <PlayIcon className="w-4 h-4 mr-2" />
                        Start Load Test
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Failover Testing</h4>
                      <div className="space-y-2">
                        <Label htmlFor="primary-trunk">Primary Trunk</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trunk" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trunk-1">
                              Trunk 1 - Primary
                            </SelectItem>
                            <SelectItem value="trunk-2">
                              Trunk 2 - Backup
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="failover-trunk">Failover Trunk</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trunk" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trunk-2">
                              Trunk 2 - Backup
                            </SelectItem>
                            <SelectItem value="trunk-3">
                              Trunk 3 - Emergency
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full">
                        <PlayIcon className="w-4 h-4 mr-2" />
                        Test Failover
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="test-history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Test History</CardTitle>
                  <CardDescription>
                    View recent test results and performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(result.type)}
                              <span className="capitalize">{result.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(result.status)}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(result.status)}
                                {result.status}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(result.startTime).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {result.duration
                              ? `${(result.duration / 1000).toFixed(1)}s`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {result.type === "options" &&
                                result.details.responseCode && (
                                  <div>
                                    Response: {result.details.responseCode}
                                  </div>
                                )}
                              {result.type === "call" && result.details.pdd && (
                                <div>PDD: {result.details.pdd}ms</div>
                              )}
                              {result.type === "route" &&
                                result.details.selectedRoute && (
                                  <div>
                                    Route: {result.details.selectedRoute}
                                  </div>
                                )}
                              {result.type === "rate" &&
                                result.details.rate && (
                                  <div>Rate: {result.details.rate}</div>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
