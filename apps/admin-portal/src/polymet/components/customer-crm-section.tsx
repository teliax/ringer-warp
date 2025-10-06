import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatabaseIcon, PlusIcon, EditIcon } from "lucide-react";
import { type CustomerAccount } from "@/polymet/data/admin-mock-data";

interface CustomerCRMSectionProps {
  customer: CustomerAccount;
}

export function CustomerCRMSection({ customer }: CustomerCRMSectionProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HubSpot Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DatabaseIcon className="w-5 h-5 mr-2" />
              HubSpot CRM Integration
            </CardTitle>
            <CardDescription>
              Customer relationship management data and sync status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">Contact Sync</div>
                  <div className="text-sm text-muted-foreground">
                    Last synced 2 hours ago
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">Deal Pipeline</div>
                  <div className="text-sm text-muted-foreground">
                    2 active opportunities
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View Deals
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">Communication History</div>
                  <div className="text-sm text-muted-foreground">
                    15 interactions this month
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View History
                </Button>
              </div>
              <div className="pt-4">
                <Button className="w-full">
                  <DatabaseIcon className="w-4 h-4 mr-2" />
                  Sync with HubSpot
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Insights</CardTitle>
            <CardDescription>
              AI-powered insights and recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium text-blue-900">
                      Upsell Opportunity
                    </div>
                    <div className="text-sm text-blue-700">
                      Customer shows 22% growth in SMS usage. Consider proposing
                      bulk SMS package.
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium text-green-900">
                      Retention Risk: Low
                    </div>
                    <div className="text-sm text-green-700">
                      Excellent payment history and consistent usage patterns
                      indicate high satisfaction.
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium text-yellow-900">
                      Action Required
                    </div>
                    <div className="text-sm text-yellow-700">
                      Contract renewal due in 3 months. Schedule renewal
                      discussion.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Communication Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Communication Log</CardTitle>
            <CardDescription>
              All customer interactions and touchpoints
            </CardDescription>
          </div>
          <Button size="sm">
            <PlusIcon className="w-4 h-4 mr-2" />
            Log Interaction
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Jan 15, 2024</TableCell>
                  <TableCell>
                    <Badge variant="outline">Email</Badge>
                  </TableCell>
                  <TableCell>Monthly usage review</TableCell>
                  <TableCell>John Smith</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800">
                      Completed
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <EditIcon className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Jan 12, 2024</TableCell>
                  <TableCell>
                    <Badge variant="outline">Call</Badge>
                  </TableCell>
                  <TableCell>Technical support - trunk configuration</TableCell>
                  <TableCell>John Smith</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800">
                      Resolved
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <EditIcon className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Jan 8, 2024</TableCell>
                  <TableCell>
                    <Badge variant="outline">Meeting</Badge>
                  </TableCell>
                  <TableCell>Quarterly business review</TableCell>
                  <TableCell>John Smith, Sarah Johnson</TableCell>
                  <TableCell>
                    <Badge className="bg-blue-100 text-blue-800">
                      Scheduled
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <EditIcon className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
