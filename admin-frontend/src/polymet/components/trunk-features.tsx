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
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SettingsIcon,
  VolumeXIcon,
  PhoneIcon,
  WifiIcon,
  ShieldIcon,
  ClockIcon,
} from "lucide-react";
import { type SipTrunk } from "@/polymet/data/trunk-mock-data";

interface TechnicalFeatures {
  codecs: {
    preferred: string[];
    allowed: string[];
    dtmfRelay: string;
    packetization: number;
    silenceSuppression: boolean;
    comfortNoise: boolean;
  };
  media: {
    rtpTimeout: number;
    rtcpInterval: number;
    mediaBypass: boolean;
    transcoding: boolean;
    recordingEnabled: boolean;
    encryptionRequired: boolean;
  };
  callFeatures: {
    callerIdPrivacy: boolean;
    callWaiting: boolean;
    callForwarding: boolean;
    conferencing: boolean;
    callTransfer: boolean;
    musicOnHold: boolean;
  };
  sip: {
    sessionTimer: number;
    registerExpiry: number;
    keepAliveInterval: number;
    maxForwards: number;
    compactHeaders: boolean;
    reliableProvisional: boolean;
  };
  security: {
    tlsRequired: boolean;
    srtpRequired: boolean;
    certificateValidation: boolean;
    allowedCiphers: string[];
    rateLimiting: boolean;
    maxCallsPerSecond: number;
  };
}

interface TrunkFeaturesProps {
  trunk?: SipTrunk | null;
  onUpdate: (features: TechnicalFeatures) => void;
}

const defaultFeatures: TechnicalFeatures = {
  codecs: {
    preferred: ["G.711u", "G.711a"],
    allowed: ["G.711u", "G.711a", "G.729", "G.722"],
    dtmfRelay: "rfc2833",
    packetization: 20,
    silenceSuppression: false,
    comfortNoise: true,
  },
  media: {
    rtpTimeout: 30,
    rtcpInterval: 5,
    mediaBypass: false,
    transcoding: true,
    recordingEnabled: false,
    encryptionRequired: false,
  },
  callFeatures: {
    callerIdPrivacy: true,
    callWaiting: true,
    callForwarding: true,
    conferencing: false,
    callTransfer: true,
    musicOnHold: true,
  },
  sip: {
    sessionTimer: 1800,
    registerExpiry: 3600,
    keepAliveInterval: 30,
    maxForwards: 70,
    compactHeaders: false,
    reliableProvisional: true,
  },
  security: {
    tlsRequired: false,
    srtpRequired: false,
    certificateValidation: true,
    allowedCiphers: ["AES_CM_128_HMAC_SHA1_80", "AES_CM_128_HMAC_SHA1_32"],
    rateLimiting: true,
    maxCallsPerSecond: 10,
  },
};

const availableCodecs = [
  { value: "G.711u", label: "G.711μ (PCMU)", bandwidth: "64 kbps" },
  { value: "G.711a", label: "G.711a (PCMA)", bandwidth: "64 kbps" },
  { value: "G.729", label: "G.729", bandwidth: "8 kbps" },
  { value: "G.722", label: "G.722 (HD)", bandwidth: "64 kbps" },
  { value: "G.726", label: "G.726", bandwidth: "16-40 kbps" },
  { value: "GSM", label: "GSM", bandwidth: "13 kbps" },
  { value: "iLBC", label: "iLBC", bandwidth: "15.2 kbps" },
  { value: "Opus", label: "Opus", bandwidth: "6-510 kbps" },
];

export function TrunkFeatures({ trunk, onUpdate }: TrunkFeaturesProps) {
  const [features, setFeatures] = useState<TechnicalFeatures>(defaultFeatures);

  const handleFeatureUpdate = (
    section: keyof TechnicalFeatures,
    updates: any
  ) => {
    const updatedFeatures = {
      ...features,
      [section]: { ...features[section], ...updates },
    };
    setFeatures(updatedFeatures);
    onUpdate(updatedFeatures);
  };

  const handleCodecToggle = (codec: string, type: "preferred" | "allowed") => {
    const currentList = features.codecs[type];
    const updatedList = currentList.includes(codec)
      ? currentList.filter((c) => c !== codec)
      : [...currentList, codec];

    handleFeatureUpdate("codecs", { [type]: updatedList });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Technical Features Configuration
          </CardTitle>
          <CardDescription>
            Configure codecs, media handling, call features, and security
            settings for this trunk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="codecs" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="codecs">Codecs</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="features">Call Features</TabsTrigger>
              <TabsTrigger value="sip">SIP Settings</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="codecs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Codec Configuration</CardTitle>
                  <CardDescription>
                    Configure supported audio codecs and media parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label className="text-base font-medium">
                        Preferred Codecs (Priority Order)
                      </Label>
                      <div className="space-y-2">
                        {availableCodecs.map((codec) => (
                          <div
                            key={codec.value}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={features.codecs.preferred.includes(
                                  codec.value
                                )}
                                onCheckedChange={() =>
                                  handleCodecToggle(codec.value, "preferred")
                                }
                              />

                              <div>
                                <div className="font-medium">{codec.label}</div>
                                <div className="text-sm text-muted-foreground">
                                  {codec.bandwidth}
                                </div>
                              </div>
                            </div>
                            {features.codecs.preferred.includes(
                              codec.value
                            ) && (
                              <Badge variant="secondary">
                                #
                                {features.codecs.preferred.indexOf(
                                  codec.value
                                ) + 1}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-medium">
                        Allowed Codecs
                      </Label>
                      <div className="space-y-2">
                        {availableCodecs.map((codec) => (
                          <div
                            key={codec.value}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={features.codecs.allowed.includes(
                                  codec.value
                                )}
                                onCheckedChange={() =>
                                  handleCodecToggle(codec.value, "allowed")
                                }
                              />

                              <div>
                                <div className="font-medium">{codec.label}</div>
                                <div className="text-sm text-muted-foreground">
                                  {codec.bandwidth}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="dtmf-relay">DTMF Relay Method</Label>
                        <Select
                          value={features.codecs.dtmfRelay}
                          onValueChange={(value) =>
                            handleFeatureUpdate("codecs", { dtmfRelay: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rfc2833">
                              RFC 2833 (Recommended)
                            </SelectItem>
                            <SelectItem value="inband">In-band</SelectItem>
                            <SelectItem value="info">SIP INFO</SelectItem>
                            <SelectItem value="auto">Auto-detect</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="packetization">
                          Packetization (ms)
                        </Label>
                        <div className="space-y-2">
                          <Slider
                            value={[features.codecs.packetization]}
                            onValueChange={([value]) =>
                              handleFeatureUpdate("codecs", {
                                packetization: value,
                              })
                            }
                            max={60}
                            min={10}
                            step={10}
                            className="w-full"
                          />

                          <div className="text-sm text-muted-foreground">
                            Current: {features.codecs.packetization}ms
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="silence-suppression">
                          Silence Suppression (VAD)
                        </Label>
                        <Switch
                          id="silence-suppression"
                          checked={features.codecs.silenceSuppression}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("codecs", {
                              silenceSuppression: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="comfort-noise">
                          Comfort Noise Generation
                        </Label>
                        <Switch
                          id="comfort-noise"
                          checked={features.codecs.comfortNoise}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("codecs", {
                              comfortNoise: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="media" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <WifiIcon className="w-5 h-5" />
                    Media Handling
                  </CardTitle>
                  <CardDescription>
                    Configure RTP/RTCP parameters and media processing options
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="rtp-timeout">
                          RTP Timeout (seconds)
                        </Label>
                        <Input
                          id="rtp-timeout"
                          type="number"
                          value={features.media.rtpTimeout}
                          onChange={(e) =>
                            handleFeatureUpdate("media", {
                              rtpTimeout: parseInt(e.target.value) || 30,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="rtcp-interval">
                          RTCP Interval (seconds)
                        </Label>
                        <Input
                          id="rtcp-interval"
                          type="number"
                          value={features.media.rtcpInterval}
                          onChange={(e) =>
                            handleFeatureUpdate("media", {
                              rtcpInterval: parseInt(e.target.value) || 5,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="media-bypass">Media Bypass</Label>
                        <Switch
                          id="media-bypass"
                          checked={features.media.mediaBypass}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("media", {
                              mediaBypass: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="transcoding">Transcoding Enabled</Label>
                        <Switch
                          id="transcoding"
                          checked={features.media.transcoding}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("media", {
                              transcoding: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="recording">Call Recording</Label>
                        <Switch
                          id="recording"
                          checked={features.media.recordingEnabled}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("media", {
                              recordingEnabled: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="encryption">
                          Media Encryption Required
                        </Label>
                        <Switch
                          id="encryption"
                          checked={features.media.encryptionRequired}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("media", {
                              encryptionRequired: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PhoneIcon className="w-5 h-5" />
                    Call Features
                  </CardTitle>
                  <CardDescription>
                    Enable or disable specific call handling features
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="caller-id-privacy">
                          Caller ID Privacy
                        </Label>
                        <Switch
                          id="caller-id-privacy"
                          checked={features.callFeatures.callerIdPrivacy}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("callFeatures", {
                              callerIdPrivacy: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="call-waiting">Call Waiting</Label>
                        <Switch
                          id="call-waiting"
                          checked={features.callFeatures.callWaiting}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("callFeatures", {
                              callWaiting: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="call-forwarding">Call Forwarding</Label>
                        <Switch
                          id="call-forwarding"
                          checked={features.callFeatures.callForwarding}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("callFeatures", {
                              callForwarding: checked,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="conferencing">Conferencing</Label>
                        <Switch
                          id="conferencing"
                          checked={features.callFeatures.conferencing}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("callFeatures", {
                              conferencing: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="call-transfer">Call Transfer</Label>
                        <Switch
                          id="call-transfer"
                          checked={features.callFeatures.callTransfer}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("callFeatures", {
                              callTransfer: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="music-on-hold">Music on Hold</Label>
                        <Switch
                          id="music-on-hold"
                          checked={features.callFeatures.musicOnHold}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("callFeatures", {
                              musicOnHold: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sip" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClockIcon className="w-5 h-5" />
                    SIP Protocol Settings
                  </CardTitle>
                  <CardDescription>
                    Configure SIP protocol parameters and timers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="session-timer">
                          Session Timer (seconds)
                        </Label>
                        <Input
                          id="session-timer"
                          type="number"
                          value={features.sip.sessionTimer}
                          onChange={(e) =>
                            handleFeatureUpdate("sip", {
                              sessionTimer: parseInt(e.target.value) || 1800,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-expiry">
                          Register Expiry (seconds)
                        </Label>
                        <Input
                          id="register-expiry"
                          type="number"
                          value={features.sip.registerExpiry}
                          onChange={(e) =>
                            handleFeatureUpdate("sip", {
                              registerExpiry: parseInt(e.target.value) || 3600,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="keepalive-interval">
                          Keep-Alive Interval (seconds)
                        </Label>
                        <Input
                          id="keepalive-interval"
                          type="number"
                          value={features.sip.keepAliveInterval}
                          onChange={(e) =>
                            handleFeatureUpdate("sip", {
                              keepAliveInterval: parseInt(e.target.value) || 30,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-forwards">
                          Max-Forwards Header
                        </Label>
                        <Input
                          id="max-forwards"
                          type="number"
                          value={features.sip.maxForwards}
                          onChange={(e) =>
                            handleFeatureUpdate("sip", {
                              maxForwards: parseInt(e.target.value) || 70,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="compact-headers">Compact Headers</Label>
                        <Switch
                          id="compact-headers"
                          checked={features.sip.compactHeaders}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("sip", {
                              compactHeaders: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="reliable-provisional">
                          Reliable Provisional Responses
                        </Label>
                        <Switch
                          id="reliable-provisional"
                          checked={features.sip.reliableProvisional}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("sip", {
                              reliableProvisional: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldIcon className="w-5 h-5" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Configure security and encryption requirements
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="tls-required">TLS Required</Label>
                        <Switch
                          id="tls-required"
                          checked={features.security.tlsRequired}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("security", {
                              tlsRequired: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="srtp-required">SRTP Required</Label>
                        <Switch
                          id="srtp-required"
                          checked={features.security.srtpRequired}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("security", {
                              srtpRequired: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="cert-validation">
                          Certificate Validation
                        </Label>
                        <Switch
                          id="cert-validation"
                          checked={features.security.certificateValidation}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("security", {
                              certificateValidation: checked,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="rate-limiting">Rate Limiting</Label>
                        <Switch
                          id="rate-limiting"
                          checked={features.security.rateLimiting}
                          onCheckedChange={(checked) =>
                            handleFeatureUpdate("security", {
                              rateLimiting: checked,
                            })
                          }
                        />
                      </div>

                      {features.security.rateLimiting && (
                        <div className="space-y-2">
                          <Label htmlFor="max-calls-per-second">
                            Max Calls Per Second
                          </Label>
                          <Input
                            id="max-calls-per-second"
                            type="number"
                            value={features.security.maxCallsPerSecond}
                            onChange={(e) =>
                              handleFeatureUpdate("security", {
                                maxCallsPerSecond:
                                  parseInt(e.target.value) || 10,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
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
