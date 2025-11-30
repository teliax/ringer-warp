import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BuildingIcon, ChevronDownIcon, CheckIcon, SearchIcon } from 'lucide-react';
import axios from 'axios';

interface Customer {
  id: string;
  company_name: string;
  ban: string;
}

export function BANSwitcher() {
  const { customerAccess, activeBan, setActiveBan, isSuperAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // SuperAdmin: fetch ALL customers when dropdown opens
  useEffect(() => {
    if (isSuperAdmin && open && allCustomers.length === 0) {
      const fetchAllCustomers = async () => {
        setLoading(true);
        try {
          const response = await axios.get('/v1/customers?per_page=1000');
          setAllCustomers(response.data.data.items || []);
        } catch (error) {
          console.error('Failed to fetch all customers:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchAllCustomers();
    }
  }, [isSuperAdmin, open, allCustomers.length]);

  // Filter displayed customers based on search query
  const displayedCustomers = isSuperAdmin
    ? allCustomers.filter((c) =>
        c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.ban.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customerAccess.filter((c) =>
        c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.ban.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleSelectBan = (customer: any) => {
    // Normalize customer object to ensure customer_id field exists
    // SuperAdmin customers have 'id', regular customers have 'customer_id'
    const normalizedCustomer = {
      ...customer,
      customer_id: customer.customer_id || customer.id,
    };

    setActiveBan(normalizedCustomer);
    setSearchQuery('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-auto min-w-[200px] justify-between">
          <div className="flex items-center space-x-2">
            <BuildingIcon className="h-4 w-4" />
            <span className="truncate">
              {activeBan ? `${activeBan.company_name}` : 'Select Customer'}
            </span>
          </div>
          <ChevronDownIcon className="h-4 w-4 ml-2 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="space-y-4 p-4">
          {/* Header */}
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Select Customer Account</h4>
            {isSuperAdmin && (
              <Badge variant="secondary" className="text-xs">
                SuperAdmin - All Customers
              </Badge>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or BAN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Customer List */}
          <ScrollArea className="h-64">
            {loading ? (
              <div className="text-center py-6 text-gray-500">
                Loading customers...
              </div>
            ) : displayedCustomers.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                {searchQuery ? 'No customers found' : 'No customers available'}
              </div>
            ) : (
              <div className="space-y-1">
                {displayedCustomers.map((customer) => (
                  <Button
                    key={customer.id || customer.customer_id}
                    variant={
                      activeBan?.customer_id === (customer.customer_id || customer.id)
                        ? 'secondary'
                        : 'ghost'
                    }
                    className="w-full justify-start h-auto py-2"
                    onClick={() => handleSelectBan(customer)}
                  >
                    <div className="flex flex-col items-start w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{customer.company_name}</span>
                        {activeBan?.customer_id === (customer.customer_id || customer.id) && (
                          <CheckIcon className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">BAN: {customer.ban}</span>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
