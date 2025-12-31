import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  ArrowLeft,
  Save,
  Send,
  XCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import type {
  Campaign10DLC,
  UpdateCampaignRequest,
  CampaignMNOStatus,
} from "@/types/messaging";
import { toast } from "sonner";

// MNO name mapping for display
const MNO_DISPLAY_NAMES: Record<string, string> = {
  "10017": "AT&T",
  "10035": "T-Mobile",
  "10038": "Verizon",
};

export function CampaignEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign10DLC | null>(null);
  const [mnoStatuses, setMnoStatuses] = useState<CampaignMNOStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [messageFlow, setMessageFlow] = useState("");
  const [sampleMessages, setSampleMessages] = useState<string[]>([]);
  const [optinMessage, setOptinMessage] = useState("");
  const [optoutMessage, setOptoutMessage] = useState("");
  const [helpMessage, setHelpMessage] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [autoRenewal, setAutoRenewal] = useState(true);

  const campaignsHook = useCampaigns();

  useEffect(() => {
    loadCampaignData();
  }, [id]);

  const loadCampaignData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const campaignData = await campaignsHook.getCampaign(id);
      setCampaign(campaignData);

      // Populate form with existing data
      setDescription(campaignData.description || "");
      setMessageFlow(campaignData.message_flow || "");
      setSampleMessages(campaignData.sample_messages || []);
      setOptinMessage(campaignData.optin_message || "");
      setOptoutMessage(campaignData.optout_message || "");
      setHelpMessage(campaignData.help_message || "");
      setPrivacyPolicyUrl(campaignData.privacy_policy_url || "");
      setTermsUrl(campaignData.terms_url || "");
      setAutoRenewal(campaignData.auto_renewal ?? true);

      // Load MNO status for rejection reasons
      const statuses = await campaignsHook.getMNOStatus(id);
      setMnoStatuses(statuses);
    } catch (error: any) {
      console.error("Failed to load campaign:", error);
      toast.error(error.message || "Failed to load campaign details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updateData: UpdateCampaignRequest = {};

      // Only include changed fields
      if (description !== campaign?.description) updateData.description = description;
      if (messageFlow !== campaign?.message_flow) updateData.message_flow = messageFlow;
      if (JSON.stringify(sampleMessages) !== JSON.stringify(campaign?.sample_messages)) {
        updateData.sample_messages = sampleMessages.filter(s => s.trim());
      }
      if (optinMessage !== campaign?.optin_message) updateData.optin_message = optinMessage;
      if (optoutMessage !== campaign?.optout_message) updateData.optout_message = optoutMessage;
      if (helpMessage !== campaign?.help_message) updateData.help_message = helpMessage;
      if (privacyPolicyUrl !== campaign?.privacy_policy_url) updateData.privacy_policy_url = privacyPolicyUrl;
      if (termsUrl !== campaign?.terms_url) updateData.terms_url = termsUrl;
      if (autoRenewal !== campaign?.auto_renewal) updateData.auto_renewal = autoRenewal;

      if (Object.keys(updateData).length === 0) {
        toast.info("No changes to save");
        return;
      }

      await campaignsHook.updateCampaign(id, updateData);
      toast.success("Campaign updated successfully");

      // Reload campaign data
      await loadCampaignData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleResubmit = async () => {
    if (!id) return;
    setResubmitting(true);
    try {
      // First save any changes
      await handleSave();

      // Then resubmit to carriers
      const result = await campaignsHook.resubmitCampaign(id);
      toast.success(result.message || "Campaign resubmitted for carrier review");

      // Navigate back to detail page
      navigate(`/messaging/campaigns/${id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to resubmit campaign");
    } finally {
      setResubmitting(false);
    }
  };

  const updateSampleMessage = (index: number, value: string) => {
    const newMessages = [...sampleMessages];
    newMessages[index] = value;
    setSampleMessages(newMessages);
  };

  const addSampleMessage = () => {
    if (sampleMessages.length < 5) {
      setSampleMessages([...sampleMessages, ""]);
    }
  };

  const removeSampleMessage = (index: number) => {
    if (sampleMessages.length > 1) {
      setSampleMessages(sampleMessages.filter((_, i) => i !== index));
    }
  };

  // Get rejection reasons from MNO statuses
  const rejectionReasons = mnoStatuses
    .filter((s) => s.rejection_reason)
    .map((s) => ({
      carrier: MNO_DISPLAY_NAMES[s.mno_id] || s.mno_name,
      reason: s.rejection_reason!,
    }));

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Campaign not found or not editable
  if (!campaign) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Campaign Not Found</AlertTitle>
          <AlertDescription>
            The requested campaign could not be found.
          </AlertDescription>
        </Alert>
        <Link to="/messaging" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Messaging
          </Button>
        </Link>
      </div>
    );
  }

  if (campaign.status !== "REJECTED" && campaign.status !== "PENDING") {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cannot Edit Campaign</AlertTitle>
          <AlertDescription>
            Only campaigns in REJECTED or PENDING status can be edited. Current
            status: {campaign.status}
          </AlertDescription>
        </Alert>
        <Link to={`/messaging/campaigns/${id}`} className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaign
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to={`/messaging/campaigns/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Campaign</h1>
            <p className="text-muted-foreground">
              TCR Campaign ID: {campaign.tcr_campaign_id || "Pending"}
            </p>
          </div>
        </div>
        <Badge
          className={
            campaign.status === "REJECTED"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }
        >
          {campaign.status}
        </Badge>
      </div>

      {/* Rejection Banner */}
      {campaign.status === "REJECTED" && rejectionReasons.length > 0 && (
        <Alert variant="destructive" className="border-red-300 bg-red-50">
          <XCircle className="h-5 w-5" />
          <AlertTitle className="text-red-900 font-semibold">
            Rejection Reasons
          </AlertTitle>
          <AlertDescription className="text-red-800">
            <div className="mt-2 space-y-2">
              {rejectionReasons.map((r, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{r.carrier}:</span>{" "}
                  <span className="break-words">{r.reason}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-medium">
              Please address the issues above and resubmit your campaign.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>
            Update the fields below to address any rejection reasons. Only
            editable fields are shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your campaign purpose (min 40 characters)"
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 characters (min 40)
            </p>
          </div>

          {/* Message Flow */}
          <div className="space-y-2">
            <Label htmlFor="messageFlow">
              Message Flow / Call-to-Action <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="messageFlow"
              value={messageFlow}
              onChange={(e) => setMessageFlow(e.target.value)}
              placeholder="Describe how users opt-in to receive messages. Include: where they sign up, consent mechanism, and mandatory disclosures."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {messageFlow.length}/500 characters (min 40). Must include specific
              opt-in location, consent method, and disclosure text.
            </p>
          </div>

          {/* Opt-In Message */}
          <div className="space-y-2">
            <Label htmlFor="optinMessage">Opt-In Confirmation Message</Label>
            <Textarea
              id="optinMessage"
              value={optinMessage}
              onChange={(e) => setOptinMessage(e.target.value)}
              placeholder='Example: "You\'re subscribed to [Brand] alerts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel."'
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              <strong>Required elements:</strong> Brand name, "Msg frequency
              varies", "Msg & data rates may apply", STOP/HELP instructions
            </p>
          </div>

          {/* Sample Messages */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Sample Messages</Label>
              {sampleMessages.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSampleMessage}
                >
                  Add Sample
                </Button>
              )}
            </div>
            {sampleMessages.map((msg, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-start gap-2">
                  <Textarea
                    value={msg}
                    onChange={(e) => updateSampleMessage(index, e.target.value)}
                    placeholder={`Sample message ${index + 1}`}
                    rows={2}
                    className="resize-none flex-1"
                  />
                  {sampleMessages.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSampleMessage(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {msg.length}/1024 characters
                </p>
              </div>
            ))}
          </div>

          {/* Opt-Out Message */}
          <div className="space-y-2">
            <Label htmlFor="optoutMessage">Opt-Out Confirmation Message</Label>
            <Textarea
              id="optoutMessage"
              value={optoutMessage}
              onChange={(e) => setOptoutMessage(e.target.value)}
              placeholder='Example: "You\'ve been unsubscribed from [Brand] messages. Reply START to re-subscribe."'
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Help Message */}
          <div className="space-y-2">
            <Label htmlFor="helpMessage">Help Response Message</Label>
            <Textarea
              id="helpMessage"
              value={helpMessage}
              onChange={(e) => setHelpMessage(e.target.value)}
              placeholder='Example: "For help, contact support@brand.com or call 1-800-XXX-XXXX. Msg & data rates may apply."'
              rows={2}
              className="resize-none"
            />
          </div>

          {/* URLs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="privacyPolicyUrl">Privacy Policy URL</Label>
              <Input
                id="privacyPolicyUrl"
                type="url"
                value={privacyPolicyUrl}
                onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                placeholder="https://example.com/privacy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="termsUrl">Terms & Conditions URL</Label>
              <Input
                id="termsUrl"
                type="url"
                value={termsUrl}
                onChange={(e) => setTermsUrl(e.target.value)}
                placeholder="https://example.com/terms"
              />
            </div>
          </div>

          {/* Auto Renewal */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto Renewal</Label>
              <p className="text-sm text-muted-foreground">
                Automatically renew campaign annually
              </p>
            </div>
            <Switch
              checked={autoRenewal}
              onCheckedChange={setAutoRenewal}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Link to={`/messaging/campaigns/${id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          variant="secondary"
          onClick={handleSave}
          disabled={saving || resubmitting}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Draft
        </Button>
        <Button onClick={handleResubmit} disabled={saving || resubmitting}>
          {resubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Save & Resubmit
        </Button>
      </div>
    </div>
  );
}
