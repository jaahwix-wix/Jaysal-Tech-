import React, { useEffect, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, ShieldAlert, X } from 'lucide-react';
import {
  auth,
  reauthenticateCurrentUserWithGoogle,
  reauthenticateCurrentUserWithPassword,
} from '../lib/firebase';

export interface HighImpactActionRequest {
  title: string;
  actionType: 'BULK_DELETE' | 'BULK_MODIFY' | 'GLOBAL_ENABLE';
  collectionLabel: string;
  recordCount: number;
  facilitySummary: string;
  detailsSummary: string;
  onExecute: () => Promise<void>;
}

interface Props {
  request: HighImpactActionRequest | null;
  onClose: () => void;
}

export const ReauthActionModal: React.FC<Props> = ({ request, onClose }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPassword('');
    setShowPassword(false);
    setVerifying(false);
    setError('');
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !verifying) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [request, verifying, onClose]);

  if (!request) return null;

  const currentUser = auth.currentUser;
  const providerIds = currentUser?.providerData?.map((p) => p.providerId) || [];
  const hasGoogleProvider = providerIds.includes('google.com');
  const hasPasswordProvider = providerIds.includes('password');
  const isDestructive = request.actionType === 'BULK_DELETE';

  const mapReauthError = (err: unknown) => {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : 'Re-authentication failed.';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Incorrect password. Re-authentication failed and the bulk operation was aborted.';
    }
    if (code === 'auth/user-mismatch') {
      return `The Google account selected does not match your signed-in Super Admin account (${currentUser?.email || 'current user'}).`;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return 'Google verification popup was closed before completing re-authentication.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many failed verification attempts. Wait briefly before trying again.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized for Google popup verification in Firebase Authentication.';
    }
    return msg;
  };

  const handlePasswordConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Enter your current account password to authorize this high-impact action.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await reauthenticateCurrentUserWithPassword(password);
      setPassword('');
      await request.onExecute();
      onClose();
    } catch (err) {
      setError(mapReauthError(err));
    } finally {
      setVerifying(false);
    }
  };

  const handleGoogleConfirm = async () => {
    setVerifying(true);
    setError('');
    try {
      await reauthenticateCurrentUserWithGoogle();
      await request.onExecute();
      onClose();
    } catch (err) {
      setError(mapReauthError(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reauth-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
            isDestructive
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isDestructive ? (
              <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            )}
            <div>
              <h3 id="reauth-modal-title" className="text-sm font-bold text-slate-900">
                {request.title}
              </h3>
              <p className="text-[11px] text-slate-600">
                Fresh Super Administrator re-authentication required
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={verifying}
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-white/70 disabled:opacity-50"
            aria-label="Cancel re-authentication"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-600">Target Dataset</span>
              <span className="font-mono font-bold text-slate-900">{request.collectionLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-600">Records Impacted</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded ${
                  isDestructive ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                }`}
              >
                {request.recordCount} {request.recordCount === 1 ? 'record' : 'records'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="font-semibold text-slate-600 shrink-0">Hospitals Scope</span>
              <span className="text-right text-slate-800 font-medium">{request.facilitySummary}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 text-slate-700 leading-relaxed">
              {request.detailsSummary}
            </div>
          </div>

          <div className="text-xs text-slate-600 flex items-start gap-2 bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Verifying identity for <strong className="text-slate-900 font-mono">{currentUser?.email || 'Super Administrator'}</strong>. Verification applies strictly to this single action.
            </span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 font-medium">
              {error}
            </div>
          )}

          {hasPasswordProvider && (
            <form onSubmit={handlePasswordConfirm} className="space-y-3">
              <div>
                <label htmlFor="reauth-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Re-enter Super Admin Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="reauth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    disabled={verifying}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter current password..."
                    className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={verifying}
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-60 ${
                    isDestructive
                      ? 'bg-red-700 hover:bg-red-800'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {verifying
                    ? 'Verifying & Executing...'
                    : isDestructive
                      ? 'Verify Password & Permanently Delete'
                      : 'Verify Password & Apply Changes'}
                </button>
              </div>
            </form>
          )}

          {hasGoogleProvider && (
            <div className={hasPasswordProvider ? 'pt-3 border-t border-slate-200 space-y-2' : 'space-y-3'}>
              {hasPasswordProvider && (
                <div className="text-[11px] font-medium text-slate-500 text-center">
                  Or re-authenticate via linked Google account
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                {!hasPasswordProvider && (
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleGoogleConfirm}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-60 ${
                    !hasPasswordProvider ? 'flex-1 sm:flex-none' : 'w-full'
                  } ${
                    isDestructive
                      ? 'bg-red-700 hover:bg-red-800'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>
                    {verifying
                      ? 'Verifying Google Session...'
                      : isDestructive
                        ? 'Verify with Google & Permanently Delete'
                        : 'Verify with Google & Apply Changes'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {!hasGoogleProvider && !hasPasswordProvider && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                No compatible re-authentication provider was detected on this session. Sign out and sign back in to perform this action.
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
