import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-serif font-bold text-gray-900 mb-2">nl-dygest</h1>
      <p className="text-gray-500 mb-8">Your daily newsletter companion</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/triage"
          className="block text-center px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
        >
          Start Triage
        </Link>
        <Link
          href="/stats"
          className="block text-center px-6 py-3 bg-gray-200 text-gray-700 rounded-full font-medium hover:bg-gray-300 transition"
        >
          View Stats
        </Link>
        <Link
          href="/api/auth"
          className="block text-center px-6 py-3 border border-gray-300 text-gray-600 rounded-full font-medium hover:bg-gray-100 transition"
        >
          Connect Gmail
        </Link>
      </div>
    </div>
  );
}
