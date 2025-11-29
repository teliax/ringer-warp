import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateInvitation, CreateInvitationRequest } from '../../hooks/useInvitations';
import { useCustomer } from '../../hooks/useCustomers';

export function UserInvitePage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading: customerLoading } = useCustomer(customerId || '');
  const createInvitation = useCreateInvitation();

  const [formData, setFormData] = useState<CreateInvitationRequest>({
    email: '',
    user_type: 'customer_admin',
    role: 'USER',
    message: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !customerId) return;

    try {
      await createInvitation.mutateAsync({
        customerId,
        data: formData,
      });

      // Show success message
      alert('Invitation sent successfully!');

      // Navigate back to customer page or users list
      navigate(`/customers/${customerId}`);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || 'Failed to send invitation';
      setErrors({ submit: errorMessage });
    }
  };

  if (customerLoading) {
    return <div className="p-6">Loading customer...</div>;
  }

  if (!customer) {
    return <div className="p-6">Customer not found</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invite User</h1>
        <p className="text-gray-600 mt-1">
          Send an invitation to join <strong>{customer.company_name}</strong> ({customer.ban})
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="user@example.com"
            required
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
        </div>

        {/* User Type Select */}
        <div>
          <label htmlFor="user_type" className="block text-sm font-medium text-gray-700 mb-1">
            User Type *
          </label>
          <select
            id="user_type"
            value={formData.user_type}
            onChange={(e) => setFormData({ ...formData, user_type: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="customer_admin">Customer Admin (Full account access)</option>
            <option value="developer">Developer (Technical/API access only)</option>
            <option value="billing">Billing (Financial access only)</option>
            <option value="viewer">Viewer (Read-only access)</option>
          </select>
          <p className="text-gray-500 text-sm mt-1">
            {formData.user_type === 'customer_admin' && 'Can manage all aspects of the customer account'}
            {formData.user_type === 'developer' && 'Can access APIs and technical configurations, but not billing'}
            {formData.user_type === 'billing' && 'Can view invoices and payment history, but not change technical settings'}
            {formData.user_type === 'viewer' && 'Can view data but cannot make any changes'}
          </p>
        </div>

        {/* Role Select */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Account Role *
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="OWNER">Owner (Full control)</option>
            <option value="ADMIN">Admin (Manage resources)</option>
            <option value="USER">User (Standard access)</option>
          </select>
          <p className="text-gray-500 text-sm mt-1">
            Account role determines level of control within the customer account
          </p>
        </div>

        {/* Custom Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Personal Message (Optional)
          </label>
          <textarea
            id="message"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Add a personal note to the invitation email..."
          />
          <p className="text-gray-500 text-sm mt-1">
            This message will be included in the invitation email
          </p>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {errors.submit}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={createInvitation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {createInvitation.isPending ? 'Sending...' : 'Send Invitation'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/customers/${customerId}`)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Preview */}
      {formData.email && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Invitation Preview</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>To:</strong> {formData.email}</p>
            <p><strong>Customer:</strong> {customer.company_name} ({customer.ban})</p>
            <p><strong>Role:</strong> {formData.user_type} ({formData.role})</p>
            <p><strong>Link Expires:</strong> 7 days from send</p>
          </div>
        </div>
      )}
    </div>
  );
}
