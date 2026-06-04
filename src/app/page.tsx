import Link from "next/link";
import { Wallet, ArrowRight, Receipt, TrendingUp, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Wallet className="h-5 w-5 text-indigo-600" />
            SplitMate
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          Built for Indian flatmates 🇮🇳
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-5">
          Split bills,<br />
          <span className="text-indigo-600">not friendships.</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 max-w-xl mx-auto mb-10">
          Track shared expenses with your roommates, see who owes what, and settle up in seconds. All amounts in ₹.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/sign-up">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              Start for free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">Sign In</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">Everything you need</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Receipt,
                title: "Track Expenses",
                desc: "Add rent, groceries, utilities and more. Split equally with one tap.",
              },
              {
                icon: TrendingUp,
                title: "Live Balances",
                desc: "Always know who owes what. Balances update instantly as expenses are added.",
              },
              {
                icon: CheckCircle,
                title: "Easy Settlements",
                desc: "Record payments and clear debts. No more awkward money conversations.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to split fairly?</h2>
        <p className="text-gray-500 mb-8">Create a room, invite your flatmates, and start tracking.</p>
        <Link href="/sign-up">
          <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            Create your first room <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        © 2026 SplitMate
      </footer>
    </div>
  );
}
