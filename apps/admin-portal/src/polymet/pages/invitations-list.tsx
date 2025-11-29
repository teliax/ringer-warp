import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useInvitations,
  useRevokeInvitation,
  useResendInvitation,
  Invitation,
} from '../../hooks/useInvitations';
import { formatDistanceToNow } from 'date-fns';

export function InvitationsListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useInvitations(statusFilter, page, 20);
  const revokeInvitation = useRevokeInvitation();
  const resendInvitation = useResendInvitation();

  const handleRevoke = async (invitation: Invitation) => {
    if (!confirm(`Are you sure you want to revoke the invitation for ${invitation.email}?`)) {
      return;
    }

    try {
      await revokeInvitation.mutateAsync(invitation.id);
      alert('Invitation revoked successfully');
      refetch();
    } catch (error: any) {
      alert(error?.response?.data?.error?.message || 'Failed to revoke invitation');
    }
  };

  const handleResend = async (invitation: Invitation) => {
    try {
      await resendInvitation.mutateAsync(invitation.id);
      alert('Invitation email resent successfully');
    } catch (error: any) {
      alert(error?.response?.data?.error?.message || 'Failed to resend invitation');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
      REVOKED: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.PENDING}`}>
        {status}
      </span>
    );
  };

  const getExpiryStatus = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 0) {
      return <span className="text-red-600 text-sm">Expired</span>;
    } else if (hoursUntilExpiry < 24) {
      return <span className="text-orange-600 text-sm font-medium">Expires in {Math.round(hoursUntilExpiry)}h</span>;
    } else {
      return <span className="text-gray-600 text-sm">Expires {formatDistanceToNow(expiryDate, { addSuffix: true })}</span>;
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading invitations...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading invitations: {(error as any)?.message || 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Invitations</h1>
          <p className="text-gray-600 mt-1">Manage pending and completed invitations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 rounded-md ${
              statusFilter === 'PENDING'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('ACCEPTED')}
            className={`px-4 py-2 rounded-md ${
              statusFilter === 'ACCEPTED'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Accepted
          </button>
          <button
            onClick={() => setStatusFilter('EXPIRED')}
            className={`px-4 py-2 rounded-md ${
              statusFilter === 'EXPIRED'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Expired
          </button>
          <button
            onClick={() => setStatusFilter('')}
            className={`px-4 py-2 rounded-md ${
              statusFilter === ''
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Invitations Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {data?.items && data.items.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invited By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.items.map((invitation) => (
                <tr key={invitation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{invitation.email}</div>
                    <div className="text-xs text-gray-500">{invitation.user_type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{invitation.customer.company_name}</div>
                    <div className="text-xs text-gray-500">{invitation.customer.ban}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{invitation.role}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invitation.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {invitation.status === 'PENDING' ? (
                      getExpiryStatus(invitation.expires_at)
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{invitation.invited_by.name}</div>
                    <div className="text-xs text-gray-500">{invitation.invited_by.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {invitation.status === 'PENDING' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleResend(invitation)}
                          disabled={resendInvitation.isPending}
                          className="text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => handleRevoke(invitation)}
                          disabled={revokeInvitation.isPending}
                          className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                    {invitation.status === 'ACCEPTED' && invitation.accepted_at && (
                      <span className="text-gray-500 text-xs">
                        Accepted {formatDistanceToNow(new Date(invitation.accepted_at), { addSuffix: true })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No {statusFilter.toLowerCase()} invitations</p>
            <p className="text-sm">Invitations you send will appear here</p>
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.total > data.pagination.per_page && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((page - 1) * data.pagination.per_page) + 1} to{' '}
              {Math.min(page * data.pagination.per_page, data.pagination.total)} of{' '}
              {data.pagination.total} invitations
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * data.pagination.per_page >= data.pagination.total}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
