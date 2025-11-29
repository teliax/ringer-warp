import { useState, useEffect } from 'react';
import { useTrunks } from '../hooks/useTrunks';
import type { TrunkGroup, TrunkIP } from '../hooks/useTrunks';

export function IPWhitelist() {
  const {
    listMyTrunks,
    addMyTrunkIP,
    deleteMyTrunkIP,
    getCustomerIngressIPs,
    getVendorOriginationIPs,
    loading,
    error,
  } = useTrunks();

  const [trunks, setTrunks] = useState<TrunkGroup[]>([]);
  const [selectedTrunk, setSelectedTrunk] = useState<TrunkGroup | null>(null);
  const [ingressIPs, setIngressIPs] = useState<any>(null);
  const [vendorIPs, setVendorIPs] = useState<any>(null);
  const [newIP, setNewIP] = useState('');
  const [newIPDescription, setNewIPDescription] = useState('');
  const [ipError, setIPError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [trunksData, ingressData, vendorData] = await Promise.all([
        listMyTrunks(),
        getCustomerIngressIPs(),
        getVendorOriginationIPs(),
      ]);

      setTrunks(trunksData);
      if (trunksData.length > 0) {
        setSelectedTrunk(trunksData[0]);
      }
      setIngressIPs(ingressData);
      setVendorIPs(vendorData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const validateIP = (ip: string): boolean => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) {
      setIPError('Invalid IP address format');
      return false;
    }

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
    if (!selectedTrunk) return;

    if (!validateIP(newIP)) return;

    try {
      await addMyTrunkIP(selectedTrunk.id, {
        ip_address: newIP,
        netmask: 32,
        description: newIPDescription || undefined,
      });

      await loadData();
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
      await deleteMyTrunkIP(selectedTrunk.id, ipID);
      await loadData();
    } catch (err) {
      console.error('Failed to delete IP:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">IP Whitelist Management</h1>
        <p className="text-gray-600 mt-2">
          Manage authorized IP addresses for your SIP trunk. Only traffic from whitelisted IPs will be accepted.
        </p>
      </div>

      {/* Network Configuration Info */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">SIP Server IPs (Send Traffic Here)</h2>
          {ingressIPs?.servers?.map((server: any, idx: number) => (
            <div key={idx} className="mb-3 p-3 bg-gray-50 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-mono text-sm font-medium">{server.hostname}</div>
                  <div className="font-mono text-xs text-gray-600">{server.ip}:{server.port}</div>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {server.protocol}
                </span>
              </div>
            </div>
          ))}
          <p className="text-sm text-gray-500 mt-3">
            Configure your SIP equipment to send calls to these servers.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Inbound Call IPs (Whitelist These)</h2>
          {vendorIPs?.ips?.map((ip: string, idx: number) => (
            <div key={idx} className="mb-2 font-mono text-sm p-2 bg-gray-50 rounded">
              {ip}
            </div>
          ))}
          <p className="text-sm text-gray-500 mt-3">
            {vendorIPs?.note}
          </p>
        </div>
      </div>

      {/* IP Whitelist Management */}
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Your IP Whitelist</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
            {error}
          </div>
        )}

        {/* Add IP Form */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-3">Add New IP Address</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">IP Address *</label>
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded ${ipError ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="203.0.113.5"
                value={newIP}
                onChange={(e) => {
                  setNewIP(e.target.value);
                  if (ipError) validateIP(e.target.value);
                }}
              />
              {ipError && <p className="text-xs text-red-500 mt-1">{ipError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (Optional)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Office IP, Data center, etc."
                value={newIPDescription}
                onChange={(e) => setNewIPDescription(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddIP}
                disabled={loading || !newIP}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add IP
              </button>
            </div>
          </div>
        </div>

        {/* IP List */}
        {selectedTrunk && selectedTrunk.ips && selectedTrunk.ips.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">IP Address</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Added</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedTrunk.ips.map((ip) => (
                <tr key={ip.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{ip.ip_address}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {ip.description || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {ip.enabled ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(ip.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteIP(ip.id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-2">No IP addresses configured</p>
            <p className="text-sm">Add at least one IP address to allow SIP traffic</p>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h4 className="font-medium text-blue-900 mb-2">How IP Authentication Works</h4>
          <p className="text-sm text-blue-800">
            When you send a SIP call to our servers, we check the source IP address against this whitelist.
            If your IP is listed, the call is authenticated and processed. If not, it's rejected with a 403 Forbidden error.
            This is more secure than username/password authentication and is the industry standard for wholesale SIP trunking.
          </p>
        </div>
      </div>
    </div>
  );
}
