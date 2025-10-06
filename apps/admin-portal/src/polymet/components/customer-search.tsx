import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SearchIcon,
  FilterIcon,
  UserIcon,
  PhoneIcon,
  CreditCardIcon,
  SettingsIcon,
  ExternalLinkIcon,
  XIcon,
} from "lucide-react";
import { mockCustomerAccounts } from "@/polymet/data/admin-mock-data";

interface CustomerSearchProps {
  onCustomerSelect?: (customer: (typeof mockCustomerAccounts)[0]) => void;
  showQuickActions?: boolean;
  compact?: boolean;
  placeholder?: string;
}

export function CustomerSearch({
  onCustomerSelect,
  showQuickActions = true,
  compact = false,
  placeholder = "Search customers by name, account, email, or phone...",
}: CustomerSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<
    (typeof mockCustomerAccounts)[0] | null
  >(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredCustomers = mockCustomerAccounts.filter((customer) => {
    const matchesSearch =
      customer.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contactPhone.includes(searchTerm) ||
      customer.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || customer.status === statusFilter;
    const matchesTier = tierFilter === "all" || customer.tier === tierFilter;

    return matchesSearch && matchesStatus && matchesTier;
  });

  const handleCustomerClick = (customer: (typeof mockCustomerAccounts)[0]) => {
    setSelectedCustomer(customer);
    if (onCustomerSelect) {
      onCustomerSelect(customer);
    }
    if (!compact) {
      setIsDialogOpen(true);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTierFilter("all");
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      suspended: "destructive",
      pending: "secondary",
      inactive: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status}
      </Badge>
    );
  };

  const getTierBadge = (tier: string) => {
    const colors = {
      enterprise: "bg-purple-100 text-purple-800",
      business: "bg-blue-100 text-blue-800",
      standard: "bg-green-100 text-green-800",
      basic: "bg-gray-100 text-gray-800",
    } as const;

    return (
      <Badge className={colors[tier as keyof typeof colors] || colors.basic}>
        {tier}
      </Badge>
    );
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {searchTerm && (
          <div className="max-h-48 overflow-y-auto border rounded-md bg-background">
            {filteredCustomers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No customers found
              </div>
            ) : (
              filteredCustomers.slice(0, 5).map((customer) => (
                <div
                  key={customer.id}
                  className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                  onClick={() => handleCustomerClick(customer)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{customer.companyName}</div>
                      <div className="text-sm text-muted-foreground">
                        {customer.accountNumber} • {customer.contactEmail}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(customer.status)}
                      {getTierBadge(customer.tier)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <SearchIcon className="w-5 h-5 text-[#58C5C7]" />

              <span>Customer Search</span>
            </CardTitle>
            <CardDescription>
              Search and manage customer accounts with advanced filtering
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="w-4 h-4 mr-2" />
              Filters
            </Button>
            {(searchTerm || statusFilter !== "all" || tierFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <XIcon className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />

              <p>No customers found matching your criteria</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-4">
                {filteredCustomers.length} of {mockCustomerAccounts.length}{" "}
                customers
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleCustomerClick(customer)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div>
                            <div className="font-medium text-lg">
                              {customer.companyName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Account: {customer.accountNumber}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center space-x-2">
                            <UserIcon className="w-4 h-4 text-muted-foreground" />

                            <span>{customer.contactName}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <PhoneIcon className="w-4 h-4 text-muted-foreground" />

                            <span>{customer.contactPhone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <CreditCardIcon className="w-4 h-4 text-muted-foreground" />

                            <span>${customer.monthlySpend}/month</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-muted-foreground">
                              Balance:
                            </span>
                            <span
                              className={
                                customer.balance >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              ${customer.balance}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2">
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(customer.status)}
                          {getTierBadge(customer.tier)}
                        </div>

                        {showQuickActions && (
                          <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="sm">
                              <ExternalLinkIcon className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <SettingsIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>

      {/* Customer Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <UserIcon className="w-5 h-5 text-[#58C5C7]" />

              <span>{selectedCustomer?.companyName}</span>
            </DialogTitle>
            <DialogDescription>
              Account: {selectedCustomer?.accountNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      {selectedCustomer.contactName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      {selectedCustomer.contactEmail}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{" "}
                      {selectedCustomer.contactPhone}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Account Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Status:</span>
                      {getStatusBadge(selectedCustomer.status)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Tier:</span>
                      {getTierBadge(selectedCustomer.tier)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Monthly Spend:
                      </span>{" "}
                      ${selectedCustomer.monthlySpend}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Balance:</span>
                      <span
                        className={
                          selectedCustomer.balance >= 0
                            ? "text-green-600 ml-1"
                            : "text-red-600 ml-1"
                        }
                      >
                        ${selectedCustomer.balance}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Products & Services</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.productsList.map((product, index) => (
                    <Badge key={index} variant="outline">
                      {product}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Close
                </Button>
                <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                  <ExternalLinkIcon className="w-4 h-4 mr-2" />
                  View Full Profile
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
