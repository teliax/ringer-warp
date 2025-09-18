import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlusIcon,
  MessageSquareIcon,
  Building2Icon,
  PhoneIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  SettingsIcon,
} from "lucide-react";
import {
  mockA2PBrands,
  mockA2PCampaigns,
  mockMessagingNumbers,
  mockDidNumbers,
  type A2PBrand,
  type A2PCampaign,
} from "@/polymet/data/telecom-mock-data";
// Form components will be imported when needed

export function Messaging() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [numberAssignDialogOpen, setNumberAssignDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");

  const getStatusBadge = (
    status: A2PBrand["status"] | A2PCampaign["status"]
  ) => {
    const variants = {
      APPROVED: "default",
      PENDING: "secondary",
      REJECTED: "destructive",
      SUSPENDED: "outline",
    } as const;

    const colors = {
      APPROVED: "bg-green-100 text-green-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      REJECTED: "bg-red-100 text-red-800",
      SUSPENDED: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const approvedBrands = mockA2PBrands.filter(
    (brand) => brand.status === "APPROVED"
  );
  const approvedCampaigns = mockA2PCampaigns.filter(
    (campaign) => campaign.status === "APPROVED"
  );
  const availableNumbers = mockDidNumbers.filter(
    (number) =>
      number.messagingEnabled &&
      !mockMessagingNumbers.some(
        (msgNum) => msgNum.phoneNumber === number.phoneNumber
      )
  );

  const totalMessagesSent = mockA2PCampaigns.reduce(
    (sum, campaign) => sum + campaign.messagesSent,
    0
  );
  const totalMessagesDelivered = mockA2PCampaigns.reduce(
    (sum, campaign) => sum + campaign.messagesDelivered,
    0
  );
  const deliveryRate =
    totalMessagesSent > 0
      ? Math.round((totalMessagesDelivered / totalMessagesSent) * 100)
      : 0;

  const handleNumberAssignment = () => {
    // Handle number assignment logic
    setNumberAssignDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messaging</h1>
          <p className="text-muted-foreground">
            Manage A2P 10DLC brands, campaigns, and messaging compliance
          </p>
        </div>

        <div className="flex space-x-2">
          <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Building2Icon className="w-4 h-4 mr-2" />
                Register Brand
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Brand Registration</DialogTitle>
                <DialogDescription>
                  Register a new brand for A2P 10DLC messaging compliance
                </DialogDescription>
              </DialogHeader>
              <div className="p-6">
                <p className="text-muted-foreground mb-4">
                  Brand registration form would appear here with fields for:
                </p>
                <ul className="space-y-2 text-sm">
                  <li>• Brand name and entity type</li>
                  <li>• Industry vertical and website</li>
                  <li>• Business address information</li>
                  <li>• Primary contact details</li>
                  <li>• EIN/Tax ID and compliance info</li>
                </ul>
                <div className="mt-6">
                  <Button onClick={() => setBrandDialogOpen(false)}>
                    Submit Brand Registration
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={campaignDialogOpen}
            onOpenChange={setCampaignDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Campaign Registration</DialogTitle>
                <DialogDescription>
                  Create a new messaging campaign for your approved brand
                </DialogDescription>
              </DialogHeader>
              <div className="p-6">
                <p className="text-muted-foreground mb-4">
                  Campaign registration form would appear here with fields for:
                </p>
                <ul className="space-y-2 text-sm">
                  <li>• Brand selection from approved brands</li>
                  <li>• Campaign name and description</li>
                  <li>• Use case type (Marketing, Mixed, etc.)</li>
                  <li>• Message flow and opt-in/out keywords</li>
                  <li>• Volume estimates and compliance details</li>
                </ul>
                <div className="mt-6">
                  <Button onClick={() => setCampaignDialogOpen(false)}>
                    Submit Campaign Registration
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Brands</CardTitle>
            <Building2Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedBrands.length}</div>
            <p className="text-xs text-muted-foreground">
              {mockA2PBrands.filter((b) => b.status === "PENDING").length}{" "}
              pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Campaigns
            </CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCampaigns.length}</div>
            <p className="text-xs text-muted-foreground">
              {mockA2PCampaigns.filter((c) => c.status === "PENDING").length}{" "}
              pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalMessagesSent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {deliveryRate}% delivery rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Assigned Numbers
            </CardTitle>
            <PhoneIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockMessagingNumbers.filter((n) => n.status === "ACTIVE").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {availableNumbers.length} available for assignment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="numbers">Numbers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest brand and campaign updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />

                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      TechCorp Communications approved
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Brand registration completed
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    2 days ago
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />

                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Marketing Promotions pending
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Campaign under review
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    1 day ago
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />

                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Customer Notifications approved
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Campaign ready for messaging
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    3 days ago
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>A2P 10DLC compliance overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Brand Verification</span>
                    <span className="text-green-600">Complete</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Campaign Approval</span>
                    <span className="text-yellow-600">In Progress</span>
                  </div>
                  <Progress value={67} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Number Assignment</span>
                    <span className="text-green-600">Active</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="brands" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registered Brands</CardTitle>
              <CardDescription>
                Manage your A2P 10DLC brand registrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand Name</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Trust Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockA2PBrands.map((brand) => (
                      <TableRow key={brand.id}>
                        <TableCell className="font-medium">
                          {brand.name}
                        </TableCell>
                        <TableCell>
                          {brand.entityType.replace("_", " ")}
                        </TableCell>
                        <TableCell>{brand.vertical}</TableCell>
                        <TableCell>{getStatusBadge(brand.status)}</TableCell>
                        <TableCell>
                          {formatDate(brand.registrationDate)}
                        </TableCell>
                        <TableCell>
                          {brand.trustScore ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium">
                                {brand.trustScore}
                              </span>
                              <Progress
                                value={brand.trustScore}
                                className="w-16 h-2"
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              Pending
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <SettingsIcon className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Messaging Campaigns</CardTitle>
              <CardDescription>
                Manage your A2P 10DLC messaging campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Use Case</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Messages Sent</TableHead>
                      <TableHead>Assigned Numbers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockA2PCampaigns.map((campaign) => {
                      const brand = mockA2PBrands.find(
                        (b) => b.id === campaign.brandId
                      );
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">
                            {campaign.name}
                          </TableCell>
                          <TableCell>{brand?.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{campaign.useCase}</Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(campaign.status)}
                          </TableCell>
                          <TableCell>
                            {campaign.messagesSent.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span>{campaign.assignedNumbers.length}</span>
                              {campaign.status === "APPROVED" && (
                                <Dialog
                                  open={numberAssignDialogOpen}
                                  onOpenChange={setNumberAssignDialogOpen}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setSelectedCampaign(campaign.id)
                                      }
                                    >
                                      <PlusIcon className="w-3 h-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>
                                        Assign Number to Campaign
                                      </DialogTitle>
                                      <DialogDescription>
                                        Select a number to assign to{" "}
                                        {campaign.name}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <Select>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select a number" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableNumbers.map((number) => (
                                            <SelectItem
                                              key={number.id}
                                              value={number.phoneNumber}
                                            >
                                              {number.phoneNumber} -{" "}
                                              {number.friendlyName || "No name"}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <div className="flex justify-end space-x-2">
                                        <Button
                                          variant="outline"
                                          onClick={() =>
                                            setNumberAssignDialogOpen(false)
                                          }
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          onClick={handleNumberAssignment}
                                        >
                                          Assign Number
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <SettingsIcon className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Messaging Numbers</CardTitle>
              <CardDescription>
                Phone numbers assigned to messaging campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Messages Sent</TableHead>
                      <TableHead>Messages Received</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockMessagingNumbers.map((number) => {
                      const campaign = mockA2PCampaigns.find(
                        (c) => c.id === number.campaignId
                      );
                      const brand = mockA2PBrands.find(
                        (b) => b.id === number.brandId
                      );
                      return (
                        <TableRow key={number.id}>
                          <TableCell className="font-mono">
                            {number.phoneNumber}
                          </TableCell>
                          <TableCell>
                            {campaign?.name || "Unassigned"}
                          </TableCell>
                          <TableCell>{brand?.name || "N/A"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                number.status === "ACTIVE"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {number.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {number.messagesSent.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {number.messagesReceived.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {number.lastActivity
                              ? formatDate(number.lastActivity)
                              : "Never"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <SettingsIcon className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
