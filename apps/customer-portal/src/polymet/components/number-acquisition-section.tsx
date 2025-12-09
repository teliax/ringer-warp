import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SearchIcon,
  ShoppingCartIcon,
  MapPinIcon,
  PhoneIcon,
  InfoIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "lucide-react";
import { useNumbers } from "@/hooks/useNumbers";
import { useToast } from "@/hooks/use-toast";
import { NumberSearchResult, SearchNumbersRequest } from "@/types/numbers";

interface NumberAcquisitionSectionProps {
  onPurchaseComplete?: () => void;
}

export function NumberAcquisitionSection({ onPurchaseComplete }: NumberAcquisitionSectionProps) {
  const [activeTab, setActiveTab] = useState<"local" | "tollfree">("local");
  const [searchResults, setSearchResults] = useState<NumberSearchResult[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const { searchAvailableNumbers, reserveNumbers, purchaseNumbers, formatPhoneNumber, loading, error } = useNumbers();
  const { toast } = useToast();

  // Local search states
  const [localSearch, setLocalSearch] = useState({
    areaCode: "",
    state: "",
    rateCenter: "",
    quantity: "10",
  });

  // Toll-free search states
  const [tollFreeSearch, setTollFreeSearch] = useState({
    npa: "800",
    quantity: "10",
  });

  const handleLocalSearch = async () => {
    setPurchaseSuccess(false);
    try {
      const params: SearchNumbersRequest = {
        npa: localSearch.areaCode || undefined,
        state: localSearch.state || undefined,
        rate_center: localSearch.rateCenter || undefined,
        page: currentPage,
        size: parseInt(localSearch.quantity) || 10,
      };

      const response = await searchAvailableNumbers(params);
      setSearchResults(response.numbers || []);
      setTotalElements(response.total_elements);
      setSelectedNumbers([]);
    } catch (err) {
      toast({
        title: "Search Failed",
        description: "Failed to search available numbers. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTollFreeSearch = async () => {
    setPurchaseSuccess(false);
    try {
      const params: SearchNumbersRequest = {
        npa: tollFreeSearch.npa,
        page: currentPage,
        size: parseInt(tollFreeSearch.quantity) || 10,
      };

      const response = await searchAvailableNumbers(params);
      setSearchResults(response.numbers || []);
      setTotalElements(response.total_elements);
      setSelectedNumbers([]);
    } catch (err) {
      toast({
        title: "Search Failed",
        description: "Failed to search toll-free numbers. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleNumberSelect = (number: string) => {
    setSelectedNumbers((prev) =>
      prev.includes(number)
        ? prev.filter((n) => n !== number)
        : [...prev, number]
    );
  };

  const handleSelectAll = () => {
    if (selectedNumbers.length === searchResults.length) {
      setSelectedNumbers([]);
    } else {
      setSelectedNumbers(searchResults.map((r) => r.telephone_number));
    }
  };

  const handlePurchase = async () => {
    if (selectedNumbers.length === 0) return;

    setIsPurchasing(true);
    try {
      // First reserve the numbers
      const reserveResponse = await reserveNumbers(selectedNumbers);

      if (reserveResponse.count === 0) {
        toast({
          title: "Reservation Failed",
          description: "Could not reserve any of the selected numbers. They may no longer be available.",
          variant: "destructive",
        });
        setIsPurchasing(false);
        return;
      }

      // Then purchase the reserved numbers
      const purchaseResponse = await purchaseNumbers({
        numbers: reserveResponse.reserved,
        voice_enabled: true,
        sms_enabled: false,
      });

      if (purchaseResponse.count > 0) {
        setPurchaseSuccess(true);
        setSelectedNumbers([]);
        setSearchResults([]);
        toast({
          title: "Purchase Successful",
          description: `Successfully purchased ${purchaseResponse.count} number(s).`,
        });

        // Notify parent to refresh inventory
        if (onPurchaseComplete) {
          onPurchaseComplete();
        }
      } else {
        toast({
          title: "Purchase Failed",
          description: "Could not complete the purchase. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Purchase Failed",
        description: "An error occurred during purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const getTotalCost = () => {
    const selectedResults = searchResults.filter((r) =>
      selectedNumbers.includes(r.telephone_number)
    );
    const monthlyTotal = selectedResults.reduce((sum, r) => sum + (r.monthly_rate || 1.50), 0);
    return { monthlyTotal, setupTotal: selectedResults.length * 0.50 };
  };

  const usStates = [
    { value: "AL", label: "Alabama" },
    { value: "AK", label: "Alaska" },
    { value: "AZ", label: "Arizona" },
    { value: "AR", label: "Arkansas" },
    { value: "CA", label: "California" },
    { value: "CO", label: "Colorado" },
    { value: "CT", label: "Connecticut" },
    { value: "DE", label: "Delaware" },
    { value: "FL", label: "Florida" },
    { value: "GA", label: "Georgia" },
    { value: "HI", label: "Hawaii" },
    { value: "ID", label: "Idaho" },
    { value: "IL", label: "Illinois" },
    { value: "IN", label: "Indiana" },
    { value: "IA", label: "Iowa" },
    { value: "KS", label: "Kansas" },
    { value: "KY", label: "Kentucky" },
    { value: "LA", label: "Louisiana" },
    { value: "ME", label: "Maine" },
    { value: "MD", label: "Maryland" },
    { value: "MA", label: "Massachusetts" },
    { value: "MI", label: "Michigan" },
    { value: "MN", label: "Minnesota" },
    { value: "MS", label: "Mississippi" },
    { value: "MO", label: "Missouri" },
    { value: "MT", label: "Montana" },
    { value: "NE", label: "Nebraska" },
    { value: "NV", label: "Nevada" },
    { value: "NH", label: "New Hampshire" },
    { value: "NJ", label: "New Jersey" },
    { value: "NM", label: "New Mexico" },
    { value: "NY", label: "New York" },
    { value: "NC", label: "North Carolina" },
    { value: "ND", label: "North Dakota" },
    { value: "OH", label: "Ohio" },
    { value: "OK", label: "Oklahoma" },
    { value: "OR", label: "Oregon" },
    { value: "PA", label: "Pennsylvania" },
    { value: "RI", label: "Rhode Island" },
    { value: "SC", label: "South Carolina" },
    { value: "SD", label: "South Dakota" },
    { value: "TN", label: "Tennessee" },
    { value: "TX", label: "Texas" },
    { value: "UT", label: "Utah" },
    { value: "VT", label: "Vermont" },
    { value: "VA", label: "Virginia" },
    { value: "WA", label: "Washington" },
    { value: "WV", label: "West Virginia" },
    { value: "WI", label: "Wisconsin" },
    { value: "WY", label: "Wyoming" },
  ];

  // Success state
  if (purchaseSuccess) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Purchase Complete!</h3>
            <p className="text-muted-foreground mb-6">
              Your numbers have been added to your inventory.
            </p>
            <Button
              onClick={() => {
                setPurchaseSuccess(false);
                setSearchResults([]);
              }}
              className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
            >
              Search for More Numbers
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShoppingCartIcon className="w-5 h-5 mr-2" />
            Number Acquisition
          </CardTitle>
          <CardDescription>
            Search and purchase local or toll-free numbers from available inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "local" | "tollfree")
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="local"
                className="flex items-center space-x-2"
              >
                <MapPinIcon className="w-4 h-4" />
                <span>Local Numbers</span>
              </TabsTrigger>
              <TabsTrigger
                value="tollfree"
                className="flex items-center space-x-2"
              >
                <PhoneIcon className="w-4 h-4" />
                <span>Toll-Free Numbers</span>
              </TabsTrigger>
            </TabsList>

            {/* Local Numbers Search */}
            <TabsContent value="local" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <InfoIcon className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    Local Number Search
                  </span>
                </div>
                <p className="text-sm text-blue-700">
                  Search by area code (NPA), state, or rate center. Local numbers
                  are tied to specific geographic locations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="area-code">Area Code (NPA)</Label>
                  <Input
                    id="area-code"
                    placeholder="e.g., 212, 415, 713"
                    value={localSearch.areaCode}
                    onChange={(e) =>
                      setLocalSearch((prev) => ({
                        ...prev,
                        areaCode: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={localSearch.state}
                    onValueChange={(value) =>
                      setLocalSearch((prev) => ({ ...prev, state: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {usStates.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate-center">Rate Center</Label>
                  <Input
                    id="rate-center"
                    placeholder="e.g., DENVER, AUSTIN"
                    value={localSearch.rateCenter}
                    onChange={(e) =>
                      setLocalSearch((prev) => ({
                        ...prev,
                        rateCenter: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="local-quantity">Results</Label>
                  <Select
                    value={localSearch.quantity}
                    onValueChange={(value) =>
                      setLocalSearch((prev) => ({ ...prev, quantity: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 numbers</SelectItem>
                      <SelectItem value="25">25 numbers</SelectItem>
                      <SelectItem value="50">50 numbers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleLocalSearch}
                disabled={loading}
                className="w-full bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                {loading ? (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2" />
                    Search Local Numbers
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Toll-Free Numbers Search */}
            <TabsContent value="tollfree" className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <InfoIcon className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Toll-Free Number Search
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  Search by prefix (800, 888, 877, etc.). Toll-free numbers work
                  nationwide.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tf-prefix">Toll-Free Prefix</Label>
                  <Select
                    value={tollFreeSearch.npa}
                    onValueChange={(value) =>
                      setTollFreeSearch((prev) => ({ ...prev, npa: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="800">800-XXX-XXXX</SelectItem>
                      <SelectItem value="888">888-XXX-XXXX</SelectItem>
                      <SelectItem value="877">877-XXX-XXXX</SelectItem>
                      <SelectItem value="866">866-XXX-XXXX</SelectItem>
                      <SelectItem value="855">855-XXX-XXXX</SelectItem>
                      <SelectItem value="844">844-XXX-XXXX</SelectItem>
                      <SelectItem value="833">833-XXX-XXXX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tf-quantity">Results</Label>
                  <Select
                    value={tollFreeSearch.quantity}
                    onValueChange={(value) =>
                      setTollFreeSearch((prev) => ({ ...prev, quantity: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 numbers</SelectItem>
                      <SelectItem value="25">25 numbers</SelectItem>
                      <SelectItem value="50">50 numbers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleTollFreeSearch}
                disabled={loading}
                className="w-full bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                {loading ? (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2" />
                    Search Toll-Free Numbers
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircleIcon className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && searchResults.length === 0 && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Available Numbers</CardTitle>
                <CardDescription>
                  {searchResults.length} of {totalElements} numbers found •{" "}
                  {selectedNumbers.length} selected
                </CardDescription>
              </div>
              {searchResults.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedNumbers.length === searchResults.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${
                    selectedNumbers.includes(result.telephone_number)
                      ? "bg-muted/50 border-[#58C5C7]"
                      : ""
                  }`}
                  onClick={() => handleNumberSelect(result.telephone_number)}
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedNumbers.includes(result.telephone_number)}
                      onCheckedChange={() => handleNumberSelect(result.telephone_number)}
                    />
                    <div>
                      <div className="font-mono font-medium">
                        {formatPhoneNumber(result.telephone_number)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.rate_center ? (
                          <>
                            <MapPinIcon className="w-3 h-3 inline mr-1" />
                            {result.rate_center}, {result.state}
                          </>
                        ) : result.npa && result.npa.startsWith("8") ? (
                          <>
                            <PhoneIcon className="w-3 h-3 inline mr-1" />
                            Toll-Free • Nationwide
                          </>
                        ) : (
                          <>
                            <MapPinIcon className="w-3 h-3 inline mr-1" />
                            {result.state || "Unknown location"}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      ${(result.monthly_rate || 1.50).toFixed(2)}/month
                    </div>
                    <div className="text-sm text-muted-foreground">
                      + $0.50 setup
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedNumbers.length > 0 && (
              <div className="flex justify-between items-center pt-4 border-t mt-4">
                <div className="text-sm">
                  <div className="font-medium">
                    {selectedNumbers.length} number
                    {selectedNumbers.length > 1 ? "s" : ""} selected
                  </div>
                  <div className="text-muted-foreground">
                    ${getTotalCost().monthlyTotal.toFixed(2)}/month + $
                    {getTotalCost().setupTotal.toFixed(2)} setup
                  </div>
                </div>
                <Button
                  onClick={handlePurchase}
                  disabled={isPurchasing}
                  className="bg-[#58C5C7] hover:bg-[#58C5C7]/80"
                >
                  {isPurchasing ? (
                    <>
                      <ShoppingCartIcon className="w-4 h-4 mr-2 animate-pulse" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCartIcon className="w-4 h-4 mr-2" />
                      Purchase Selected Numbers
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
