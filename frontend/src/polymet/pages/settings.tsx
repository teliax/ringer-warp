import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UsersIcon,
  KeyIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  SettingsIcon,
} from "lucide-react";

const settingsModules = [
  {
    name: "Users",
    href: "/settings/users",
    icon: UsersIcon,
    description: "Manage team members and assign roles",
    details: "Invite users, set permissions, and control access levels",
    status: "Active",
    statusColor: "bg-[#58C5C7]",
  },
  {
    name: "OAuth Tokens",
    href: "/settings/oauth",
    icon: KeyIcon,
    description: "API access tokens and scoping",
    details:
      "Create tokens with REST actions, IP whitelisting, and module access",
    status: "Available",
    statusColor: "bg-[#FBAD18]",
  },
  {
    name: "KYC Information",
    href: "/settings/kyc",
    icon: ShieldCheckIcon,
    description: "Know Your Customer details",
    details: "Business information, FEIN, USF Filer ID, and RMD compliance",
    status: "Required",
    statusColor: "bg-orange-500",
  },
];

export function Settings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#231F20]">Settings</h1>
        <p className="text-gray-600">
          Manage your account settings, team members, and security preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {settingsModules.map((module) => (
          <Card
            key={module.name}
            className="border-gray-200 hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <module.icon className="h-6 w-6 text-[#231F20]" />
                  </div>
                  <div>
                    <CardTitle className="text-[#231F20]">
                      {module.name}
                    </CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </div>
                </div>
                <Badge
                  className={`${module.statusColor} hover:${module.statusColor}/80 text-white`}
                >
                  {module.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{module.details}</p>
              <Link to={module.href}>
                <Button
                  variant="outline"
                  className="w-full border-[#58C5C7] text-[#58C5C7] hover:bg-[#58C5C7] hover:text-white"
                >
                  Configure
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-[#231F20] flex items-center">
              <SettingsIcon className="mr-2 h-5 w-5" />
              Account Overview
            </CardTitle>
            <CardDescription>
              Current account status and configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Account Type</span>
              <Badge variant="outline">Enterprise</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Active Users</span>
              <span className="text-sm">5 of 25</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">API Tokens</span>
              <span className="text-sm">3 active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">KYC Status</span>
              <Badge className="bg-green-500 hover:bg-green-500/80">
                Verified
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-[#231F20]">Recent Activity</CardTitle>
            <CardDescription>
              Latest settings changes and updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-[#58C5C7] rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">New API token created</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-[#FBAD18] rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">User role updated</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">KYC information verified</p>
                <p className="text-xs text-gray-500">3 days ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold mb-2 text-[#231F20]">
          Settings Management
        </h3>
        <div className="text-sm space-y-1">
          <div>✓ User management with role-based access control</div>
          <div>✓ OAuth token creation with granular scoping</div>
          <div>✓ KYC compliance and business verification</div>
          <div>✓ Security settings and access controls</div>
        </div>
      </div>
    </div>
  );
}
