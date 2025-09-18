import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  PlayIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  NetworkIcon,
  PhoneIcon,
  DollarSignIcon,
} from "lucide-react";
import { mockTrunks, type SipTrunk } from "@/polymet/data/trunk-mock-data";

interface ValidationRule {
  id: string;
  category:
    | "basic"
    | "network"
    | "authentication"
    | "routing"
    | "rates"
    | "features";
  name: string;
  description: string;
  severity: "error" | "warning" | "info";
  validator: (trunk: Partial<SipTrunk>) => ValidationResult;
}

interface ValidationResult {
  passed: boolean;
  message: string;
  suggestion?: string;
}

interface TrunkValidationProps {
  trunk?: SipTrunk | null;
  onValidationComplete?: (results: ValidationResults) => void;
  autoValidate?: boolean;
}

interface ValidationResults {
  overall: "passed" | "failed" | "warnings";
  score: number;
  results: Array<{
    rule: ValidationRule;
    result: ValidationResult;
  }>;
  errors: number;
  warnings: number;
  passed: number;
}

const validationRules: ValidationRule[] = [
  // Basic Configuration Rules
  {
    id: "basic-name",
    category: "basic",
    name: "Trunk Name",
    description: "Trunk must have a valid name",
    severity: "error",
    validator: (trunk) => ({
      passed: !!(trunk.basic?.name && trunk.basic.name.length >= 3),
      message: trunk.basic?.name
        ? "Valid trunk name"
        : "Trunk name is required (minimum 3 characters)",
      suggestion:
        "Use descriptive names like 'Customer-Acme-Primary' or 'Vendor-Bandwidth-Termination'",
    }),
  },
  {
    id: "basic-description",
    category: "basic",
    name: "Description",
    description: "Trunk should have a description",
    severity: "warning",
    validator: (trunk) => ({
      passed: !!(
        trunk.basic?.description && trunk.basic.description.length >= 10
      ),

      message: trunk.basic?.description
        ? "Description provided"
        : "Consider adding a detailed description",
      suggestion: "Include purpose, customer/vendor info, and capacity details",
    }),
  },
  {
    id: "basic-capacity",
    category: "basic",
    name: "Capacity Limits",
    description: "Capacity should be properly configured",
    severity: "error",
    validator: (trunk) => ({
      passed: !!(
        trunk.basic?.maxConcurrentCalls && trunk.basic.maxConcurrentCalls > 0
      ),

      message: trunk.basic?.maxConcurrentCalls
        ? "Capacity configured"
        : "Maximum concurrent calls must be set",
      suggestion: "Set appropriate capacity based on expected traffic volume",
    }),
  },

  // Network Configuration Rules
  {
    id: "network-ip",
    category: "network",
    name: "IP Configuration",
    description: "Valid IP addresses are required",
    severity: "error",
    validator: (trunk) => {
      const hasValidIPs =
        trunk.network?.ipAddresses && trunk.network.ipAddresses.length > 0;
      return {
        passed: !!hasValidIPs,
        message: hasValidIPs
          ? "IP addresses configured"
          : "At least one IP address is required",
        suggestion: "Add primary and backup IP addresses for redundancy",
      };
    },
  },
  {
    id: "network-ports",
    category: "network",
    name: "Port Configuration",
    description: "SIP and RTP ports should be configured",
    severity: "warning",
    validator: (trunk) => {
      const hasPorts = trunk.network?.sipPort || trunk.network?.rtpPortRange;
      return {
        passed: !!hasPorts,
        message: hasPorts
          ? "Ports configured"
          : "Consider configuring custom ports",
        suggestion: "Use non-standard ports for enhanced security",
      };
    },
  },

  // Authentication Rules
  {
    id: "auth-method",
    category: "authentication",
    name: "Authentication Method",
    description: "Authentication method must be selected",
    severity: "error",
    validator: (trunk) => ({
      passed: !!trunk.authentication?.method,
      message: trunk.authentication?.method
        ? `Using ${trunk.authentication.method}`
        : "Authentication method required",
      suggestion:
        "Choose IP ACL for trusted networks or SIP Digest for enhanced security",
    }),
  },
  {
    id: "auth-security",
    category: "authentication",
    name: "Security Configuration",
    description: "Security settings should be properly configured",
    severity: "warning",
    validator: (trunk) => {
      const hasSecurityFeatures =
        trunk.authentication?.requireTls || trunk.authentication?.enableSrtp;
      return {
        passed: !!hasSecurityFeatures,
        message: hasSecurityFeatures
          ? "Security features enabled"
          : "Consider enabling TLS/SRTP",
        suggestion: "Enable TLS for signaling and SRTP for media encryption",
      };
    },
  },

  // Routing Rules
  {
    id: "routing-partition",
    category: "routing",
    name: "Partition Assignment",
    description: "Trunk should be assigned to a partition",
    severity: "error",
    validator: (trunk) => ({
      passed: !!trunk.routing?.partition,
      message: trunk.routing?.partition
        ? `Assigned to ${trunk.routing.partition}`
        : "Partition assignment required",
      suggestion: "Assign to appropriate partition for proper call routing",
    }),
  },
  {
    id: "routing-patterns",
    category: "routing",
    name: "Routing Patterns",
    description: "At least one routing pattern should be configured",
    severity: "warning",
    validator: (trunk) => {
      const hasPatterns =
        trunk.routing?.dialPatterns && trunk.routing.dialPatterns.length > 0;
      return {
        passed: !!hasPatterns,
        message: hasPatterns
          ? "Routing patterns configured"
          : "Consider adding specific routing patterns",
        suggestion: "Add patterns for better call routing control",
      };
    },
  },

  // Rate Configuration Rules
  {
    id: "rates-configured",
    category: "rates",
    name: "Rate Configuration",
    description: "Rates should be configured for billing",
    severity: "error",
    validator: (trunk) => {
      const hasRates = trunk.rates?.zones && trunk.rates.zones.length > 0;
      return {
        passed: !!hasRates,
        message: hasRates ? "Rates configured" : "Rate configuration required",
        suggestion: "Configure rates for all relevant zones and destinations",
      };
    },
  },
  {
    id: "rates-validation",
    category: "rates",
    name: "Rate Validation",
    description: "Rates should be within reasonable ranges",
    severity: "warning",
    validator: (trunk) => {
      const rates = trunk.rates?.zones || [];
      const hasReasonableRates = rates.every(
        (zone) => zone.rate >= 0.001 && zone.rate <= 10.0
      );
      return {
        passed: hasReasonableRates,
        message: hasReasonableRates
          ? "Rates within normal range"
          : "Some rates may be outside normal range",
        suggestion: "Review rates to ensure they're competitive and profitable",
      };
    },
  },

  // Features Rules
  {
    id: "features-codecs",
    category: "features",
    name: "Codec Configuration",
    description: "At least one codec should be configured",
    severity: "warning",
    validator: (trunk) => {
      const hasCodecs =
        trunk.features?.codecs && trunk.features.codecs.length > 0;
      return {
        passed: !!hasCodecs,
        message: hasCodecs
          ? "Codecs configured"
          : "Consider configuring preferred codecs",
        suggestion:
          "Configure G.711, G.729, or other codecs based on quality requirements",
      };
    },
  },
];

export function TrunkValidation({
  trunk,
  onValidationComplete,
  autoValidate = true,
}: TrunkValidationProps) {
  const [validationResults, setValidationResults] =
    useState<ValidationResults | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const runValidation = async () => {
    if (!trunk) return;

    setIsValidating(true);

    // Simulate validation delay for real-world feel
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const results = validationRules.map((rule) => ({
      rule,
      result: rule.validator(trunk),
    }));

    const errors = results.filter(
      (r) => !r.result.passed && r.rule.severity === "error"
    ).length;
    const warnings = results.filter(
      (r) => !r.result.passed && r.rule.severity === "warning"
    ).length;
    const passed = results.filter((r) => r.result.passed).length;

    const score = Math.round((passed / results.length) * 100);
    const overall =
      errors > 0 ? "failed" : warnings > 0 ? "warnings" : "passed";

    const validationResults: ValidationResults = {
      overall,
      score,
      results,
      errors,
      warnings,
      passed,
    };

    setValidationResults(validationResults);
    setIsValidating(false);

    onValidationComplete?.(validationResults);
  };

  useEffect(() => {
    if (autoValidate && trunk) {
      runValidation();
    }
  }, [trunk, autoValidate]);

  const getStatusColor = (severity: string, passed: boolean) => {
    if (passed) return "text-green-600";
    return severity === "error" ? "text-red-600" : "text-yellow-600";
  };

  const getStatusIcon = (severity: string, passed: boolean) => {
    if (passed) return <CheckCircleIcon className="w-4 h-4 text-green-600" />;

    return severity === "error" ? (
      <XCircleIcon className="w-4 h-4 text-red-600" />
    ) : (
      <AlertTriangleIcon className="w-4 h-4 text-yellow-600" />
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "basic":
        return <ShieldCheckIcon className="w-4 h-4" />;

      case "network":
        return <NetworkIcon className="w-4 h-4" />;

      case "authentication":
        return <ShieldCheckIcon className="w-4 h-4" />;

      case "routing":
        return <PhoneIcon className="w-4 h-4" />;

      case "rates":
        return <DollarSignIcon className="w-4 h-4" />;

      case "features":
        return <CheckCircleIcon className="w-4 h-4" />;

      default:
        return <CheckCircleIcon className="w-4 h-4" />;
    }
  };

  const filteredResults =
    validationResults?.results.filter(
      (r) => selectedCategory === "all" || r.rule.category === selectedCategory
    ) || [];

  const categories = [
    "all",
    ...Array.from(new Set(validationRules.map((r) => r.category))),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShieldCheckIcon className="w-5 h-5 text-[#58C5C7]" />

            <span>Trunk Configuration Validation</span>
          </CardTitle>
          <CardDescription>
            Comprehensive validation and error checking for SIP trunk
            configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Validation Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={runValidation}
                disabled={!trunk || isValidating}
                className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                {isValidating ? (
                  <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PlayIcon className="w-4 h-4 mr-2" />
                )}
                {isValidating ? "Validating..." : "Run Validation"}
              </Button>

              {validationResults && (
                <div className="flex items-center space-x-2">
                  <Badge
                    className={
                      validationResults.overall === "passed"
                        ? "bg-green-100 text-green-800"
                        : validationResults.overall === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    Score: {validationResults.score}%
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {validationResults.passed} passed,{" "}
                    {validationResults.warnings} warnings,{" "}
                    {validationResults.errors} errors
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Validation Progress */}
          {validationResults && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Validation Score</span>
                <span className="font-medium">{validationResults.score}%</span>
              </div>
              <Progress value={validationResults.score} className="h-2" />
            </div>
          )}

          {/* Overall Status Alert */}
          {validationResults && (
            <Alert
              className={
                validationResults.overall === "passed"
                  ? "border-green-200 bg-green-50"
                  : validationResults.overall === "failed"
                    ? "border-red-200 bg-red-50"
                    : "border-yellow-200 bg-yellow-50"
              }
            >
              <AlertDescription className="flex items-center space-x-2">
                {validationResults.overall === "passed" ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                ) : validationResults.overall === "failed" ? (
                  <XCircleIcon className="w-4 h-4 text-red-600" />
                ) : (
                  <AlertTriangleIcon className="w-4 h-4 text-yellow-600" />
                )}
                <span>
                  {validationResults.overall === "passed"
                    ? "Configuration validation passed successfully"
                    : validationResults.overall === "failed"
                      ? `Configuration has ${validationResults.errors} critical errors that must be resolved`
                      : `Configuration has ${validationResults.warnings} warnings that should be reviewed`}
                </span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResults && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>
              Detailed validation results by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="network">Network</TabsTrigger>
                <TabsTrigger value="authentication">Auth</TabsTrigger>
                <TabsTrigger value="routing">Routing</TabsTrigger>
                <TabsTrigger value="rates">Rates</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
              </TabsList>

              <TabsContent value={selectedCategory} className="mt-6">
                <div className="space-y-4">
                  {filteredResults.map(({ rule, result }, index) => (
                    <div
                      key={rule.id}
                      className="flex items-start space-x-4 p-4 border rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getStatusIcon(rule.severity, result.passed)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          {getCategoryIcon(rule.category)}
                          <h4 className="font-medium">{rule.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {rule.category}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              rule.severity === "error"
                                ? "border-red-200 text-red-700"
                                : rule.severity === "warning"
                                  ? "border-yellow-200 text-yellow-700"
                                  : "border-blue-200 text-blue-700"
                            }`}
                          >
                            {rule.severity}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          {rule.description}
                        </p>

                        <p
                          className={`text-sm font-medium ${getStatusColor(rule.severity, result.passed)}`}
                        >
                          {result.message}
                        </p>

                        {!result.passed && result.suggestion && (
                          <p className="text-sm text-blue-600 mt-1">
                            💡 {result.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Quick Fix Suggestions */}
      {validationResults &&
        (validationResults.errors > 0 || validationResults.warnings > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangleIcon className="w-5 h-5 text-[#FBAD18]" />

                <span>Quick Fix Recommendations</span>
              </CardTitle>
              <CardDescription>
                Prioritized actions to improve your trunk configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {validationResults.results
                  .filter(
                    (r) => !r.result.passed && r.rule.severity === "error"
                  )
                  .slice(0, 3)
                  .map(({ rule, result }, index) => (
                    <div
                      key={rule.id}
                      className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-xs font-medium text-red-700">
                        {index + 1}
                      </div>
                      <div>
                        <h5 className="font-medium text-red-900">
                          {rule.name}
                        </h5>
                        <p className="text-sm text-red-700">
                          {result.suggestion}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

export default TrunkValidation;
