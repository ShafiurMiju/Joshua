export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Joshua
        </h1>
        <p className="text-gray-500 mb-6">
          GHL Opportunity Manager — Fast loading with local database caching
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-2">How to access:</p>
          <code className="bg-white px-3 py-1.5 rounded border border-gray-200 text-blue-600 text-sm">
            /location/YOUR_LOCATION_ID
          </code>
          <p className="mt-3 text-xs text-gray-400">
            Replace <code className="bg-gray-100 px-1 rounded">YOUR_LOCATION_ID</code> with your GoHighLevel location ID.
          </p>
        </div>
      </div>
    </div>
  );
}
