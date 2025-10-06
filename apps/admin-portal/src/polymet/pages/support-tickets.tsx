import { useEffect } from "react";
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
  ExternalLinkIcon,
  TicketIcon,
  ClockIcon,
  UserIcon,
  ArrowRightIcon,
} from "lucide-react";

export function SupportTickets() {
  const handleRedirect = () => {
    window.open("https://support.ringer.tel/a/dashboard/default", "_blank");
  };

  useEffect(() => {
    // Auto-redirect after 3 seconds if user doesn't click
    const timer = setTimeout(() => {
      handleRedirect();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold flex items-center justify-center space-x-2 mb-2">
          <TicketIcon className="w-8 h-8 text-[#58C5C7]" />

          <span>Support Tickets</span>
        </h1>
        <p className="text-muted-foreground">
          Redirecting to external support system...
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 bg-[#58C5C7] rounded-full flex items-center justify-center">
                  <ExternalLinkIcon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-[#FBAD18] hover:bg-[#FBAD18]/80">
                    External
                  </Badge>
                </div>
              </div>
            </div>
            <CardTitle className="text-xl">External Support System</CardTitle>
            <CardDescription>
              Support tickets are managed through our dedicated support portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                You will be redirected to our external support system where you
                can:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <TicketIcon className="w-4 h-4 text-[#58C5C7]" />

                    <span className="font-medium">Manage Tickets</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    View, create, and track support tickets
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <ClockIcon className="w-4 h-4 text-[#58C5C7]" />

                    <span className="font-medium">Real-time Updates</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get instant notifications and updates
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <UserIcon className="w-4 h-4 text-[#58C5C7]" />

                    <span className="font-medium">Expert Support</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connect with specialized support agents
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <ExternalLinkIcon className="w-4 h-4 text-[#58C5C7]" />

                    <span className="font-medium">Knowledge Base</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Access documentation and FAQs
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleRedirect}
                  className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                  size="lg"
                >
                  <span>Go to Support Portal</span>
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Auto-redirecting in 3 seconds...
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Support Portal URL:
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  https://support.ringer.tel/a/dashboard/default
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
