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
import {
  SearchIcon,
  ShoppingCartIcon,
  MapPinIcon,
  PhoneIcon,
  InfoIcon,
} from "lucide-react";

interface NumberSearchResult {
  number: string;
  rate: number;
  setupFee: number;
  city?: string;
  state?: string;
  pattern?: string;
  type: "local" | "tollfree";
}

export function NumberAcquisitionSection() {
  const [activeTab, setActiveTab] = useState<"local" | "tollfree">("local");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NumberSearchResult[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);

  // Local search states
  const [localSearch, setLocalSearch] = useState({
    areaCode: "",
    city: "",
    state: "",
    zipCode: "",
    pattern: "",
    quantity: "10",
  });

  // Toll-free search states
  const [tollFreeSearch, setTollFreeSearch] = useState({
    prefix: "800",
    pattern: "",
    wordPattern: "",
    quantity: "10",
  });

  const handleLocalSearch = async () => {
    setIsSearching(true);

    // Simulate API call
    setTimeout(() => {
      const mockResults: NumberSearchResult[] = [];
      const quantity = parseInt(localSearch.quantity) || 10;

      for (let i = 0; i < quantity; i++) {
        const areaCode = localSearch.areaCode || "212";
        const exchange = Math.floor(Math.random() * 900) + 100;
        const number = Math.floor(Math.random() * 9000) + 1000;

        mockResults.push({
          number: `+1 (${areaCode}) ${exchange}-${number}`,
          rate: 1.5,
          setupFee: 0.5,
          city: localSearch.city || "New York",
          state: localSearch.state || "NY",
          type: "local",
        });
      }

      setSearchResults(mockResults);
      setIsSearching(false);
    }, 2000);
  };

  const handleTollFreeSearch = async () => {
    setIsSearching(true);

    // Simulate API call
    setTimeout(() => {
      const mockResults: NumberSearchResult[] = [];
      const quantity = parseInt(tollFreeSearch.quantity) || 10;
      const prefix = tollFreeSearch.prefix;

      for (let i = 0; i < quantity; i++) {
        let number;

        if (tollFreeSearch.wordPattern) {
          // Generate numbers that could spell words
          const wordPatterns = [
            "FLOWERS",
            "SUPPORT",
            "HOTLINE",
            "SERVICE",
            "CONNECT",
          ];

          const pattern =
            wordPatterns[Math.floor(Math.random() * wordPatterns.length)];
          number = `+1 (${prefix}) ${pattern.substring(0, 3)}-${pattern.substring(3)}`;
        } else if (tollFreeSearch.pattern) {
          // Use custom pattern
          const patternNum = tollFreeSearch.pattern.replace(/[^\d]/g, "");
          number = `+1 (${prefix}) ${patternNum.substring(0, 3)}-${patternNum.substring(3, 7)}`;
        } else {
          // Random toll-free number
          const exchange = Math.floor(Math.random() * 900) + 100;
          const num = Math.floor(Math.random() * 9000) + 1000;
          number = `+1 (${prefix}) ${exchange}-${num}`;
        }

        mockResults.push({
          number,
          rate: 2.0,
          setupFee: 1.0,
          pattern: tollFreeSearch.wordPattern || tollFreeSearch.pattern,
          type: "tollfree",
        });
      }

      setSearchResults(mockResults);
      setIsSearching(false);
    }, 2000);
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
      setSelectedNumbers(searchResults.map((r) => r.number));
    }
  };

  const getTotalCost = () => {
    const selectedResults = searchResults.filter((r) =>
      selectedNumbers.includes(r.number)
    );
    const monthlyTotal = selectedResults.reduce((sum, r) => sum + r.rate, 0);
    const setupTotal = selectedResults.reduce((sum, r) => sum + r.setupFee, 0);
    return { monthlyTotal, setupTotal };
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShoppingCartIcon className="w-5 h-5 mr-2" />
            Number Acquisition
          </CardTitle>
          <CardDescription>
            Search and purchase local or toll-free numbers with advanced
            filtering options
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
                  Search by area code (NPA), city, state, zip code, or word
                  patterns. Local numbers are tied to specific geographic
                  locations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., New York, San Francisco"
                    value={localSearch.city}
                    onChange={(e) =>
                      setLocalSearch((prev) => ({
                        ...prev,
                        city: e.target.value,
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
                  <Label htmlFor="zip-code">Zip Code</Label>
                  <Input
                    id="zip-code"
                    placeholder="e.g., 10001, 94105"
                    value={localSearch.zipCode}
                    onChange={(e) =>
                      setLocalSearch((prev) => ({
                        ...prev,
                        zipCode: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="local-pattern">Word/Number Pattern</Label>
                  <Input
                    id="local-pattern"
                    placeholder="e.g., PIZZA, 555-HELP"
                    value={localSearch.pattern}
                    onChange={(e) =>
                      setLocalSearch((prev) => ({
                        ...prev,
                        pattern: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="local-quantity">Quantity</Label>
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
                      <SelectItem value="5">5 numbers</SelectItem>
                      <SelectItem value="10">10 numbers</SelectItem>
                      <SelectItem value="25">25 numbers</SelectItem>
                      <SelectItem value="50">50 numbers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleLocalSearch}
                disabled={isSearching}
                className="w-full bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                {isSearching ? (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2 animate-spin" />
                    Searching Local Numbers...
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
                  Search by prefix (800, 888, 877, etc.) and patterns. Toll-free
                  numbers work nationwide and can spell memorable words.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tf-prefix">Toll-Free Prefix</Label>
                  <Select
                    value={tollFreeSearch.prefix}
                    onValueChange={(value) =>
                      setTollFreeSearch((prev) => ({ ...prev, prefix: value }))
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
                  <Label htmlFor="tf-quantity">Quantity</Label>
                  <Select
                    value={tollFreeSearch.quantity}
                    onValueChange={(value) =>
                      setTollFreeSearch((prev) => ({
                        ...prev,
                        quantity: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 numbers</SelectItem>
                      <SelectItem value="10">10 numbers</SelectItem>
                      <SelectItem value="25">25 numbers</SelectItem>
                      <SelectItem value="50">50 numbers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tf-word-pattern">Word Pattern</Label>
                  <Input
                    id="tf-word-pattern"
                    placeholder="e.g., FLOWERS, SUPPORT, HOTLINE"
                    value={tollFreeSearch.wordPattern}
                    onChange={(e) =>
                      setTollFreeSearch((prev) => ({
                        ...prev,
                        wordPattern: e.target.value,
                      }))
                    }
                  />

                  <p className="text-xs text-muted-foreground">
                    Search for numbers that spell words (e.g., 833-FLOWERS)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tf-number-pattern">Number Pattern</Label>
                  <Input
                    id="tf-number-pattern"
                    placeholder="e.g., XXX-1234, 555-XXXX"
                    value={tollFreeSearch.pattern}
                    onChange={(e) =>
                      setTollFreeSearch((prev) => ({
                        ...prev,
                        pattern: e.target.value,
                      }))
                    }
                  />

                  <p className="text-xs text-muted-foreground">
                    Use X for any digit, specific numbers for exact matches
                  </p>
                </div>
              </div>

              <Button
                onClick={handleTollFreeSearch}
                disabled={isSearching}
                className="w-full bg-[#58C5C7] hover:bg-[#58C5C7]/80"
              >
                {isSearching ? (
                  <>
                    <SearchIcon className="w-4 h-4 mr-2 animate-spin" />
                    Searching Toll-Free Numbers...
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

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Available Numbers</CardTitle>
                <CardDescription>
                  {searchResults.length} {activeTab} numbers found •{" "}
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
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedNumbers.includes(result.number)}
                      onCheckedChange={() => handleNumberSelect(result.number)}
                    />

                    <div>
                      <div className="font-mono font-medium">
                        {result.number}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.type === "local" ? (
                          <>
                            <MapPinIcon className="w-3 h-3 inline mr-1" />
                            {result.city}, {result.state}
                          </>
                        ) : (
                          <>
                            <PhoneIcon className="w-3 h-3 inline mr-1" />
                            Toll-Free • Nationwide
                            {result.pattern && ` • Pattern: ${result.pattern}`}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      ${result.rate.toFixed(2)}/month
                    </div>
                    <div className="text-sm text-muted-foreground">
                      + ${result.setupFee.toFixed(2)} setup
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedNumbers.length > 0 && (
              <div className="flex justify-between items-center pt-4 border-t">
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
                <Button className="bg-[#58C5C7] hover:bg-[#58C5C7]/80">
                  Purchase Selected Numbers
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
