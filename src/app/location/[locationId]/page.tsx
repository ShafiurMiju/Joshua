'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ApiKeyForm from '@/components/ApiKeyForm';
import OpportunityBoard from '@/components/OpportunityBoard';
import { Loader2 } from 'lucide-react';

export default function LocationPage() {
  const params = useParams();
  const locationId = params.locationId as string;

  const [status, setStatus] = useState<'loading' | 'needsApiKey' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;

    async function checkLocation() {
      try {
        const res = await fetch(`/api/location/${locationId}`);
        const data = await res.json();

        if (!cancelled) {
          setStatus(data.hasApiKey ? 'ready' : 'needsApiKey');
        }
      } catch (error) {
        console.error('Error checking location:', error);
        if (!cancelled) setStatus('needsApiKey');
      }
    }

    checkLocation();
    return () => { cancelled = true; };
  }, [locationId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'needsApiKey') {
    return (
      <ApiKeyForm
        locationId={locationId}
        onSuccess={() => setStatus('ready')}
      />
    );
  }

  return <OpportunityBoard locationId={locationId} />;
}
