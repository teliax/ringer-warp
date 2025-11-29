import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvitation, useAcceptInvitation } from '../hooks/useInvitations';
import { useAuth } from '../lib/auth/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const acceptInvitation = useAcceptInvitation();

  const { data: invitation, isLoading, error } = useInvitation(token || '');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!invitation || !token) return;

    try {
      setAccepting(true);
      setAcceptError(null);

      // Store invitation token for OAuth callback to use
      sessionStorage.setItem('invitation_token', token);

      // Trigger Google OAuth (will redirect away and come back to /oauth-callback)
      await signInWithGoogle();

      // Note: This code won't execute because signInWithGoogle redirects
      // The OAuth callback page will handle the invitation acceptance
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error?.message || 'Failed to start authentication';
      setAcceptError(errorMsg);
      setAccepting(false);
    }
  };

  // Error states
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const status = (error as any)?.response?.status;
    const errorCode = (error as any)?.response?.data?.error?.code;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>

          {status === 410 || errorCode === 'EXPIRED' ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Expired</h1>
              <p className="text-gray-600 mb-6">
                This invitation link has expired. Please contact your administrator to request a new invitation.
              </p>
            </>
          ) : errorCode === 'REVOKED' ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Revoked</h1>
              <p className="text-gray-600 mb-6">
                This invitation has been cancelled. Please contact your administrator for more information.
              </p>
            </>
          ) : errorCode === 'ALREADY_ACCEPTED' ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Accepted</h1>
              <p className="text-gray-600 mb-6">
                This invitation has already been accepted. You can sign in to access your account.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Login
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
              <p className="text-gray-600 mb-6">
                This invitation link is not valid. Please check the link or contact your administrator.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  // Valid pending invitation
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white text-center">
          <h1 className="text-3xl font-bold mb-2">You've Been Invited!</h1>
          <p className="text-blue-100">Join {invitation.customer.company_name} on WARP Platform</p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="space-y-6">
            {/* Company Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Account Details</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Company</dt>
                  <dd className="text-sm text-gray-900 font-semibold">{invitation.customer.company_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Account Number</dt>
                  <dd className="text-sm text-gray-900 font-mono">{invitation.customer.ban}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Your Role</dt>
                  <dd className="text-sm text-gray-900">{invitation.role}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Access Level</dt>
                  <dd className="text-sm text-gray-900">{invitation.user_type_description || invitation.user_type}</dd>
                </div>
              </dl>
            </div>

            {/* Invited By */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Invited by</h3>
              <p className="text-sm text-gray-900">
                {invitation.invited_by.name} ({invitation.invited_by.email})
              </p>
            </div>

            {/* Personal Message */}
            {invitation.message && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Personal Message</h3>
                <div className="bg-gray-50 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm text-gray-700 italic">{invitation.message}</p>
                </div>
              </div>
            )}

            {/* Capabilities */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">What you'll be able to do</h3>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-sm text-gray-700">Manage SIP trunks and voice routing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-sm text-gray-700">Purchase and configure phone numbers</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-sm text-gray-700">Send and receive SMS/MMS messages</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-sm text-gray-700">View call detail records and analytics</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-sm text-gray-700">Monitor usage and billing</span>
                </li>
              </ul>
            </div>

            {/* Expiry Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>This invitation expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}</strong>
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Invitation sent on {new Date(invitation.sent_at).toLocaleDateString()}
              </p>
            </div>

            {/* Error Message */}
            {acceptError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{acceptError}</p>
              </div>
            )}

            {/* Accept Button */}
            <div className="pt-4">
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-medium"
              >
                {accepting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Accepting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                    </svg>
                    <span>Sign in with Google to Accept</span>
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                You'll need to sign in with <strong>{invitation.email}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            This invitation link is valid for 7 days and can only be used once.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            If you didn't expect this invitation, you can safely ignore it.
          </p>
        </div>
      </div>
    </div>
  );
}
