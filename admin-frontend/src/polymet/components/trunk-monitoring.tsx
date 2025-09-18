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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  ClockIcon,
  EyeIcon,
  PhoneIcon,
  TrendingUpIcon,
  WifiIcon,
} from "lucide-react";
import { type SipTrunk } from "@/polymet/data/trunk-mock-data";

interface QualityThresholds {
  asr: { warning: number; critical: number; enabled: boolean };
  acd: { warning: number; critical: number; enabled: boolean };
  pdd: { warning: number; critical: number; enabled: boolean };
  jitter: { warning: number; critical: number; enabled: boolean };
  packetLoss: { warning: number; critical: number; enabled: boolean };
  mos: { warning: number; critical: number; enabled: boolean };
}

interface MonitoringConfig {
  qualityThresholds: QualityThresholds;
  alerting: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    webhookEnabled: boolean;
    alertEmails: string[];
    escalationMinutes: number;
  };
  homer: {
    enabled: boolean;
    sipCapture: boolean;
    rtpCapture: boolean;
    retentionDays: number;
    compressionEnabled: boolean;
  };
  reporting: {
    dailyReports: boolean;
    weeklyReports: boolean;
    monthlyReports: boolean;
    customReports: boolean;
    reportEmails: string[];
  };
}

interface TrunkMonitoringProps {
  trunk?: SipTrunk | null;
  onUpdate: (config: MonitoringConfig) => void;
}

const defaultConfig: MonitoringConfig = {
  qualityThresholds: {
    asr: { warning: 95, critical: 90, enabled: true },
    acd: { warning: 120, critical: 180, enabled: true },
    pdd: { warning: 3000, critical: 5000, enabled: true },
    jitter: { warning: 30, critical: 50, enabled: true },
    packetLoss: { warning: 1, critical: 3, enabled: true },
    mos: { warning: 3.5, critical: 3.0, enabled: true },
  },
  alerting: {
    emailEnabled: true,
    smsEnabled: false,
    webhookEnabled: false,
    alertEmails: ["admin@company.com", "noc@company.com"],
    escalationMinutes: 15,
  },
  homer: {
    enabled: true,
    sipCapture: true,
    rtpCapture: false,
    retentionDays: 30,
    compressionEnabled: true,
  },
  reporting: {
    dailyReports: true,
    weeklyReports: true,
    monthlyReports: true,
    customReports: false,
    reportEmails: ["reports@company.com"],
  },
};

const mockQualityData = [
  { time: "00:00", asr: 98.2, acd: 85, pdd: 2100, mos: 4.1 },
  { time: "04:00", asr: 97.8, acd: 92, pdd: 2300, mos: 4.0 },
  { time: "08:00", asr: 96.5, acd: 110, pdd: 2800, mos: 3.8 },
  { time: "12:00", asr: 95.2, acd: 125, pdd: 3200, mos: 3.6 },
  { time: "16:00", asr: 94.8, acd: 135, pdd: 3500, mos: 3.5 },
  { time: "20:00", asr: 96.1, acd: 118, pdd: 2900, mos: 3.7 },
];

export function TrunkMonitoring({ trunk, onUpdate }: TrunkMonitoringProps) {
  const [config, setConfig] = useState<MonitoringConfig>(defaultConfig);

  const handleConfigUpdate = (
    section: keyof MonitoringConfig,
    updates: any
  ) => {
    const updatedConfig = {
      ...config,
      [section]: { ...config[section], ...updates },
    };
    setConfig(updatedConfig);
    onUpdate(updatedConfig);
  };

  const handleThresholdUpdate = (
    metric: keyof QualityThresholds,
    updates: any
  ) => {
    const updatedThresholds = {
      ...config.qualityThresholds,
      [metric]: { ...config.qualityThresholds[metric], ...updates },
    };
    handleConfigUpdate("qualityThresholds", updatedThresholds);
  };

  const getQualityStatus = (
    value: number,
    threshold: { warning: number; critical: number }
  ) => {
    if (value <= threshold.critical) return "critical";
    if (value <= threshold.warning) return "warning";
    return "good";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "text-red-600 bg-red-100";
      case "warning":
        return "text-yellow-600 bg-yellow-100";
      case "good":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="w-5 h-5" />
            Trunk Monitoring & Quality Management
          </CardTitle>
          <CardDescription>
            Configure quality thresholds, alerting, Homer integration, and
            reporting for this trunk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="quality" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
              <TabsTrigger value="alerting">Alerting</TabsTrigger>
              <TabsTrigger value="homer">Homer Integration</TabsTrigger>
              <TabsTrigger value="reporting">Reporting</TabsTrigger>
            </TabsList>

            <TabsContent value="quality" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Real-time Quality Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          94.8%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current ASR
                        </div>
                        <Badge
                          className={getStatusColor(
                            getQualityStatus(94.8, config.qualityThresholds.asr)
                          )}
                        >
                          {getQualityStatus(94.8, config.qualityThresholds.asr)}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          135s
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current ACD
                        </div>
                        <Badge
                          className={getStatusColor(
                            getQualityStatus(135, config.qualityThresholds.acd)
                          )}
                        >
                          {getQualityStatus(135, config.qualityThresholds.acd)}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          3.5s
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current PDD
                        </div>
                        <Badge
                          className={getStatusColor(
                            getQualityStatus(3500, config.qualityThresholds.pdd)
                          )}
                        >
                          {getQualityStatus(3500, config.qualityThresholds.pdd)}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          3.5
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current MOS
                        </div>
                        <Badge
                          className={getStatusColor(
                            getQualityStatus(3.5, config.qualityThresholds.mos)
                          )}
                        >
                          {getQualityStatus(3.5, config.qualityThresholds.mos)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">24-Hour Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      className="aspect-[none] h-[200px]"
                      config={{}}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={mockQualityData}>
                          <CartesianGrid strokeDasharray="3 3" />

                          <XAxis dataKey="time" />

                          <ChartTooltip />

                          <Line
                            type="monotone"
                            dataKey="asr"
                            stroke="hsl(var(--chart-1))"
                            strokeWidth={2}
                            name="ASR %"
                          />

                          <Line
                            type="monotone"
                            dataKey="mos"
                            stroke="hsl(var(--chart-2))"
                            strokeWidth={2}
                            name="MOS"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Quality Thresholds Configuration
                  </CardTitle>
                  <CardDescription>
                    Set warning and critical thresholds for quality metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(config.qualityThresholds).map(
                    ([metric, threshold]) => (
                      <div key={metric} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-medium capitalize">
                            {metric.toUpperCase()} Monitoring
                          </Label>
                          <Switch
                            checked={threshold.enabled}
                            onCheckedChange={(checked) =>
                              handleThresholdUpdate(
                                metric as keyof QualityThresholds,
                                { enabled: checked }
                              )
                            }
                          />
                        </div>
                        {threshold.enabled && (
                          <div className="grid grid-cols-2 gap-4 ml-4">
                            <div className="space-y-2">
                              <Label htmlFor={`${metric}-warning`}>
                                Warning Threshold
                              </Label>
                              <Input
                                id={`${metric}-warning`}
                                type="number"
                                step={metric === "mos" ? "0.1" : "1"}
                                value={threshold.warning}
                                onChange={(e) =>
                                  handleThresholdUpdate(
                                    metric as keyof QualityThresholds,
                                    {
                                      warning: parseFloat(e.target.value) || 0,
                                    }
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${metric}-critical`}>
                                Critical Threshold
                              </Label>
                              <Input
                                id={`${metric}-critical`}
                                type="number"
                                step={metric === "mos" ? "0.1" : "1"}
                                value={threshold.critical}
                                onChange={(e) =>
                                  handleThresholdUpdate(
                                    metric as keyof QualityThresholds,
                                    {
                                      critical: parseFloat(e.target.value) || 0,
                                    }
                                  )
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerting" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangleIcon className="w-5 h-5" />
                    Alert Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure how and when to receive quality alerts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email-alerts">Email Alerts</Label>
                      <Switch
                        id="email-alerts"
                        checked={config.alerting.emailEnabled}
                        onCheckedChange={(checked) =>
                          handleConfigUpdate("alerting", {
                            emailEnabled: checked,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="sms-alerts">SMS Alerts</Label>
                      <Switch
                        id="sms-alerts"
                        checked={config.alerting.smsEnabled}
                        onCheckedChange={(checked) =>
                          handleConfigUpdate("alerting", {
                            smsEnabled: checked,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="webhook-alerts">Webhook Alerts</Label>
                      <Switch
                        id="webhook-alerts"
                        checked={config.alerting.webhookEnabled}
                        onCheckedChange={(checked) =>
                          handleConfigUpdate("alerting", {
                            webhookEnabled: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="alert-emails">
                        Alert Email Addresses
                      </Label>
                      <Input
                        id="alert-emails"
                        value={config.alerting.alertEmails.join(", ")}
                        onChange={(e) =>
                          handleConfigUpdate("alerting", {
                            alertEmails: e.target.value
                              .split(",")
                              .map((email) => email.trim()),
                          })
                        }
                        placeholder="admin@company.com, noc@company.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="escalation-minutes">
                        Escalation Time (minutes)
                      </Label>
                      <Input
                        id="escalation-minutes"
                        type="number"
                        value={config.alerting.escalationMinutes}
                        onChange={(e) =>
                          handleConfigUpdate("alerting", {
                            escalationMinutes: parseInt(e.target.value) || 15,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="homer" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <EyeIcon className="w-5 h-5" />
                    Homer SIP Capture Integration
                  </CardTitle>
                  <CardDescription>
                    Configure SIP and RTP capture for troubleshooting and
                    analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="homer-enabled">
                      Enable Homer Integration
                    </Label>
                    <Switch
                      id="homer-enabled"
                      checked={config.homer.enabled}
                      onCheckedChange={(checked) =>
                        handleConfigUpdate("homer", { enabled: checked })
                      }
                    />
                  </div>

                  {config.homer.enabled && (
                    <div className="space-y-4 ml-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="sip-capture">
                            SIP Message Capture
                          </Label>
                          <Switch
                            id="sip-capture"
                            checked={config.homer.sipCapture}
                            onCheckedChange={(checked) =>
                              handleConfigUpdate("homer", {
                                sipCapture: checked,
                              })
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="rtp-capture">
                            RTP Stream Capture
                          </Label>
                          <Switch
                            id="rtp-capture"
                            checked={config.homer.rtpCapture}
                            onCheckedChange={(checked) =>
                              handleConfigUpdate("homer", {
                                rtpCapture: checked,
                              })
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="compression">
                            Enable Compression
                          </Label>
                          <Switch
                            id="compression"
                            checked={config.homer.compressionEnabled}
                            onCheckedChange={(checked) =>
                              handleConfigUpdate("homer", {
                                compressionEnabled: checked,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="retention-days">
                            Retention Period (days)
                          </Label>
                          <Input
                            id="retention-days"
                            type="number"
                            value={config.homer.retentionDays}
                            onChange={(e) =>
                              handleConfigUpdate("homer", {
                                retentionDays: parseInt(e.target.value) || 30,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium mb-2">
                          Homer Configuration Status
                        </h4>
                        <div className="text-sm space-y-1">
                          <div>✓ Homer server: homer.company.com:9060</div>
                          <div>✓ HEP protocol version: 3</div>
                          <div>✓ Capture agent: Active</div>
                          <div>✓ Storage: 2.3TB available</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reporting" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3Icon className="w-5 h-5" />
                    Quality Reporting
                  </CardTitle>
                  <CardDescription>
                    Configure automated quality reports and distribution
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="daily-reports">Daily Reports</Label>
                        <Switch
                          id="daily-reports"
                          checked={config.reporting.dailyReports}
                          onCheckedChange={(checked) =>
                            handleConfigUpdate("reporting", {
                              dailyReports: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="weekly-reports">Weekly Reports</Label>
                        <Switch
                          id="weekly-reports"
                          checked={config.reporting.weeklyReports}
                          onCheckedChange={(checked) =>
                            handleConfigUpdate("reporting", {
                              weeklyReports: checked,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="monthly-reports">Monthly Reports</Label>
                        <Switch
                          id="monthly-reports"
                          checked={config.reporting.monthlyReports}
                          onCheckedChange={(checked) =>
                            handleConfigUpdate("reporting", {
                              monthlyReports: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="custom-reports">Custom Reports</Label>
                        <Switch
                          id="custom-reports"
                          checked={config.reporting.customReports}
                          onCheckedChange={(checked) =>
                            handleConfigUpdate("reporting", {
                              customReports: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="report-emails">
                      Report Email Recipients
                    </Label>
                    <Input
                      id="report-emails"
                      value={config.reporting.reportEmails.join(", ")}
                      onChange={(e) =>
                        handleConfigUpdate("reporting", {
                          reportEmails: e.target.value
                            .split(",")
                            .map((email) => email.trim()),
                        })
                      }
                      placeholder="reports@company.com, management@company.com"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
