import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg shadow-blue-500/25 mb-6">
            <span className="text-2xl font-bold text-white">CP</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            CleverProfits Portal
          </h1>
          <p className="text-slate-500 mb-8">
            Access your monthly financial reports
          </p>

          {/* Sign In Button */}
          <Link
            href="/sign-in"
            className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          >
            Sign In
          </Link>

          {/* Help Link */}
          <p className="text-sm text-slate-400 mt-6">
            Need access?{" "}
            <a
              href="mailto:support@cleverprofits.com"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Contact CleverProfits
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-slate-400">
        <span>© 2025 CleverProfits · Secure & Encrypted</span>
      </footer>
    </div>
  );
}
