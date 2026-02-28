import Link from 'next/link';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center font-sans p-4">
      <div className="w-full max-w-2xl py-16">
        <Link
          href="/"
          className="text-sm text-blue-500 font-bold hover:underline mb-8 inline-block"
        >
          ← Back to Home
        </Link>

        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
          Cookie Policy
        </h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: June 2025</p>

        <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 space-y-4 text-sm text-gray-600 leading-relaxed">
          <p>
            This is a placeholder cookie policy for Mimamori. A full cookie
            policy covering the types of cookies used, their purposes, and how
            to manage your preferences will be published before the application
            is made publicly available.
          </p>
          <p>
            If you have questions about cookies and tracking, please contact our
            team.
          </p>
        </div>
      </div>
    </div>
  );
}
