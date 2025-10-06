import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityIcon, TrendingUpIcon } from "lucide-react";
import { type CustomerAccount } from "@/polymet/data/admin-mock-data";

interface CustomerAnalyticsSectionProps {
  customer: CustomerAccount;
}

export function CustomerAnalyticsSection({
  customer,
}: CustomerAnalyticsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Health Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ActivityIcon className="w-5 h-5 mr-2" />
              Customer Health Score
            </CardTitle>
            <CardDescription>
              Overall account health and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Payment History</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: "92%" }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">92%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Usage Consistency</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: "87%" }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">87%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Support Engagement</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: "75%" }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">75%</span>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Overall Health</span>
                  <Badge className="bg-green-100 text-green-800">
                    Excellent
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUpIcon className="w-5 h-5 mr-2" />
              Usage Trends
            </CardTitle>
            <CardDescription>
              6-month usage and spending patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 border rounded">
                  <div className="text-2xl font-bold text-green-600">+15%</div>
                  <div className="text-sm text-muted-foreground">
                    Call Volume
                  </div>
                </div>
                <div className="text-center p-3 border rounded">
                  <div className="text-2xl font-bold text-blue-600">+8%</div>
                  <div className="text-sm text-muted-foreground">Revenue</div>
                </div>
                <div className="text-center p-3 border rounded">
                  <div className="text-2xl font-bold text-purple-600">+22%</div>
                  <div className="text-sm text-muted-foreground">SMS Usage</div>
                </div>
                <div className="text-center p-3 border rounded">
                  <div className="text-2xl font-bold text-orange-600">
                    98.2%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Success Rate
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <h4 className="font-medium mb-2">Recommendations</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>
                    • Consider upgrading to premium trunk for better rates
                  </li>
                  <li>• SMS usage growing - discuss bulk pricing</li>
                  <li>
                    • Excellent payment history - eligible for credit increase
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Timeline</CardTitle>
          <CardDescription>
            Latest account activities and system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Payment received - $2,500.00</p>
                  <span className="text-sm text-muted-foreground">
                    2 hours ago
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatic payment processed successfully
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">New SIP trunk configured</p>
                  <span className="text-sm text-muted-foreground">
                    1 day ago
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Trunk 'ACME-TRUNK-06' added to account
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Support ticket resolved</p>
                  <span className="text-sm text-muted-foreground">
                    3 days ago
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ticket #12345 - Call quality issue resolved
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Credit limit increased</p>
                  <span className="text-sm text-muted-foreground">
                    1 week ago
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Credit limit raised from $3,000 to $5,000
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
