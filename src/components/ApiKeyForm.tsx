'use client';

import { useState } from 'react';
import { KeyRound, Loader2, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface ApiKeyFormProps {
  locationId: string;
  onSuccess: () => void;
}

export default function ApiKeyForm({ locationId, onSuccess }: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/location/${locationId}/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to validate API key');
        return;
      }

      onSuccess();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Connect GoHighLevel</h1>
          <p className="text-gray-500 mt-2">
            Enter your Private Integration API key to connect this location.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pit-xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-900 placeholder-gray-400 bg-white"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Location ID: <span className="font-mono">{locationId}</span>
            </p>
          </div>

          {/* How to get API key instructions */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 font-medium transition-colors"
            >
              <span>How to get your API key?</span>
              {showInstructions ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {showInstructions && (
              <div className="px-4 py-4 bg-white text-sm text-gray-600 space-y-3 border-t border-gray-200">
                <ol className="space-y-2 list-decimal list-inside">
                  <li>
                    Log in to your{' '}
                    <a
                      href="https://app.gohighlevel.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      GoHighLevel account
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    Navigate to <strong>Settings</strong> in the left sidebar
                  </li>
                  <li>
                    Click on <strong>Integrations</strong>
                  </li>
                  <li>
                    Select <strong>Private Integrations</strong> tab
                  </li>
                  <li>
                    Click <strong>+ Add Private Integration</strong> to create a new one, or copy an existing key
                  </li>
                  <li>
                    Give it a name, set the required scopes, then click <strong>Create</strong>
                  </li>
                  <li>
                    Copy the generated API key (starts with <code className="bg-gray-100 px-1 rounded font-mono text-xs">pit-</code>) and paste it above
                  </li>
                </ol>
                <p className="text-xs text-gray-400 mt-2">
                  Note: Make sure the integration has <strong>Opportunities</strong> and <strong>Contacts</strong> scopes enabled.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !apiKey}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
