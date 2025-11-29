import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Trash2, Globe, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTrunks } from '@/hooks/useTrunks';
import type { TrunkGroup, TrunkIP } from '@/hooks/useTrunks';

interface TrunkIPWhitelistProps {
  customerBAN: string;
}

export function TrunkIPWhitelist({ customerBAN }: TrunkIPWhitelistProps) {
  const {
    listCustomerTrunks,
    createTrunk,
    addTrunkIP,
    deleteTrunkIP,
    getCustomerIngressIPs,
    getVendorOriginationIPs,
    loading,
    error: apiError
  } = useTrunks();

  const [trunks, setTrunks] = useState<TrunkGroup[]>([]);
  const [ingressIPs, setIngressIPs] = useState<any>(null);
  const [vendorIPs, setVendorIPs] = useState<any>(null);
  const [selectedTrunk, setSelectedTrunk] = useState<TrunkGroup | null>(null);

  // Add IP form state
  const [newIP, setNewIP] = useState('');
  const [newIPDescription, setNewIPDescription] = useState('');
  const [ipError, setIPError] = useState('');

  // Load trunks and network IPs on mount
  useEffect(() => {
    loadTrunks();
    loadNetworkInfo();
  }, [customerBAN]);

  const loadTrunks = async () => {
    try {
      const data = await listCustomerTrunks(customerBAN);
      setTrunks(data);

      // Auto-create default trunk if none exists
      if (data.length === 0) {
        await createDefaultTrunk();
      } else {
        setSelectedTrunk(data[0]); // Select first trunk
      }
    } catch (err) {
      console.error('Failed to load trunks:', err);
    }
  };

  const loadNetworkInfo = async () => {
    try {
      const [ingress, vendor] = await Promise.all([
        getCustomerIngressIPs(),
        getVendorOriginationIPs()
      ]);
      setIngressIPs(ingress);
      setVendorIPs(vendor);
    } catch (err) {
      console.error('Failed to load network info:', err);
    }
  };

  const createDefaultTrunk = async () => {
    try {
      const trunk = await createTrunk(customerBAN, {
        name: 'Primary SIP Trunk',
        description: 'Default SIP trunk for IP-based authentication',
        auth_type: 'IP_ACL',
        capacity_cps: 100,
        capacity_concurrent_calls: 1000,
      });
      setTrunks([trunk]);
      setSelectedTrunk(trunk);
    } catch (err) {
      console.error('Failed to create default trunk:', err);
    }
  };

  const validateIP = (ip: string): boolean => {
    // Basic IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) {
      setIPError('Invalid IP address format');
      return false;
    }

    // Check each octet is 0-255
    const octets = ip.split('.');
    for (const octet of octets) {
      const num = parseInt(octet, 10);
      if (num < 0 || num > 255) {
        setIPError('IP address octets must be between 0-255');
        return false;
      }
    }

    setIPError('');
    return true;
  };

  const handleAddIP = async () => {
    if (!selectedTrunk) {
      setIPError('No trunk selected');
      return;
    }

    if (!validateIP(newIP)) {
      return;
    }

    try {
      await addTrunkIP(customerBAN, selectedTrunk.id, {
        ip_address: newIP,
        netmask: 32, // Single IP
        description: newIPDescription || `IP added ${new Date().toLocaleDateString()}`,
      });

      // Reload trunks to get updated IP list
      await loadTrunks();

      // Reset form
      setNewIP('');
      setNewIPDescription('');
      setIPError('');
    } catch (err) {
      console.error('Failed to add IP:', err);
    }
  };

  const handleDeleteIP = async (ipID: string) => {
    if (!selectedTrunk) return;

    if (!confirm('Remove this IP from the whitelist? Traffic from this IP will be rejected.')) {
      return;
    }

    try {
      await deleteTrunkIP(customerBAN, selectedTrunk.id, ipID);
      await loadTrunks(); // Reload to update list
    } catch (err) {
      console.error('Failed to delete IP:', err);
    }
  };

  if (loading && trunks.length === 0) {
    return <div className="p-4">Loading trunk configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Network Information */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center">
              <Globe className="w-4 h-4 mr-2" />
              SIP Server IPs (Customer Configuration)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-2">
              {ingressIPs?.servers?.map((server: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span className="font-mono">{server.ip}</span>
                  <Badge variant="outline" className="text-xs">
                    {server.protocol} {server.port}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Customer sends traffic TO these IPs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Vendor Whitelist IPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              {vendorIPs?.ips?.map((ip: string, idx: number) => (
                <div key={idx} className="font-mono">{ip}</div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Customer receives traffic FROM these IPs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* IP Whitelist Management */}
      <Card>
        <CardHeader>
          <CardTitle>IP Whitelist (Source IP Authentication)</CardTitle>
          <CardDescription>
            Add customer source IP addresses to allow SIP traffic. Traffic from unlisted IPs will be rejected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}

          {/* Add IP Form */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="ip-address">IP Address</Label>
              <Input
                id="ip-address"
                placeholder="203.0.113.5"
                value={newIP}
                onChange={(e) => {
                  setNewIP(e.target.value);
                  if (ipError) validateIP(e.target.value);
                }}
                className={ipError ? 'border-red-500' : ''}
              />
              {ipError && (
                <p className="text-xs text-red-500 mt-1">{ipError}</p>
              )}
            </div>
            <div className="flex-1">
              <Label htmlFor="ip-description">Description (Optional)</Label>
              <Input
                id="ip-description"
                placeholder="Office IP, Data center, etc."
                value={newIPDescription}
                onChange={(e) => setNewIPDescription(e.target.value)}
              />
            </div>
            <div className="pt-6">
              <Button
                onClick={handleAddIP}
                disabled={loading || !newIP}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add IP
              </Button>
            </div>
          </div>

          {/* IP List */}
          {selectedTrunk && selectedTrunk.ips && selectedTrunk.ips.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>CIDR</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTrunk.ips.map((ip) => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono">{ip.ip_address}</TableCell>
                      <TableCell>/{ip.netmask}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ip.description || '—'}
                      </TableCell>
                      <TableCell>
                        {ip.enabled ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(ip.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteIP(ip.id)}
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No IP addresses configured. Add at least one IP address to allow SIP traffic from the customer.
              </AlertDescription>
            </Alert>
          )}

          {/* Trunk Info */}
          {selectedTrunk && (
            <div className="mt-4 p-4 bg-muted rounded-lg text-sm space-y-2">
              <div><strong>Trunk:</strong> {selectedTrunk.name}</div>
              <div><strong>Auth Type:</strong> {selectedTrunk.auth_type}</div>
              <div><strong>Capacity:</strong> {selectedTrunk.capacity_cps} CPS, {selectedTrunk.capacity_concurrent_calls} concurrent calls</div>
              <div><strong>Status:</strong> {selectedTrunk.enabled ? 'Enabled' : 'Disabled'}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> When a SIP INVITE arrives from one of the whitelisted IPs above, Kamailio will authenticate the customer and route the call.
          Traffic from any other IP will be rejected with 403 Forbidden. Changes take effect within 60 seconds.
        </AlertDescription>
      </Alert>
    </div>
  );
}
