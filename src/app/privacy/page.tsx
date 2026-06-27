import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — SplitMate",
  description: "How SplitMate collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-lg tracking-tight">
          SplitMate
        </Link>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← Back to home
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: 25 June 2026</p>

        <Section title="1. Who we are">
          <p>
            SplitMate (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a web application that helps
            roommates and groups track shared expenses and settle payments. The service is operated by the
            SplitMate team and is available at{" "}
            <span className="font-medium text-gray-800">splitmate.co.in</span>.
          </p>
        </Section>

        <Section title="2. What information we collect">
          <Subsection title="Account information (via Clerk)">
            <p>
              Authentication is handled by Clerk. When you sign up or sign in, Clerk processes your name,
              email address, and (if you use Google Sign-In) your Google profile photo. We receive and store
              a copy of your name, email, and avatar URL in our database to associate you with rooms and
              expenses.
            </p>
          </Subsection>
          <Subsection title="Expense and room data">
            <p>
              Any rooms you create or join, expenses you log, and settlements you record are stored in our
              database. This includes titles, amounts, categories, dates, notes, and participant information
              you enter.
            </p>
          </Subsection>
          <Subsection title="Usage and technical data">
            <p>
              Our hosting provider (Vercel) and rate-limiting service (Upstash) may log your IP address and
              request metadata for security and performance purposes. We do not run our own analytics
              tracker.
            </p>
          </Subsection>
        </Section>

        <Section title="3. How we use your information">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To operate the service — showing your expenses, balances, and settlement history</li>
            <li>To send transactional email notifications (e.g., &quot;Pavan added an expense&quot;) via Resend</li>
            <li>To enforce rate limits and protect the service from abuse</li>
            <li>To display your name and avatar to your roommates in shared rooms</li>
          </ul>
          <p className="mt-3">
            We do not sell your data, serve you ads, or use your data for purposes other than operating and
            improving SplitMate.
          </p>
        </Section>

        <Section title="4. Third-party services">
          <p className="mb-3">
            We rely on the following third-party services, each with their own privacy policies:
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">Service</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">Purpose</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">Data shared</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Clerk", "Authentication & identity", "Name, email, profile photo"],
                ["Neon (PostgreSQL)", "Database", "All app data (rooms, expenses, members)"],
                ["Vercel", "Hosting & CDN", "Request logs, IP addresses"],
                ["Resend", "Transactional email", "Recipient email, notification content"],
                ["Upstash Redis", "Rate limiting", "Hashed user ID or IP address"],
              ].map(([service, purpose, data]) => (
                <tr key={service} className="border-b border-gray-100">
                  <td className="px-3 py-2 border border-gray-200 font-medium">{service}</td>
                  <td className="px-3 py-2 border border-gray-200 text-gray-600">{purpose}</td>
                  <td className="px-3 py-2 border border-gray-200 text-gray-600">{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="5. Data retention">
          <p>
            Your account data is retained for as long as you have an account with us. Expense and room
            records use soft-deletes — deleted items are flagged rather than immediately removed, which
            preserves the audit trail for other room members. If you wish to have your personal data fully
            removed, contact us and we will process the request within 30 days.
          </p>
        </Section>

        <Section title="6. Your rights">
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate information (name can be updated in your Profile page)</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent at any time by deleting your account</li>
          </ul>
          <p className="mt-3">
            These rights are consistent with the Information Technology Act, 2000, and the Digital Personal
            Data Protection Act, 2023 (India).
          </p>
        </Section>

        <Section title="7. Children">
          <p>
            SplitMate is not directed at children under 13. We do not knowingly collect personal information
            from anyone under 13. If you believe a minor has provided us their information, contact us and
            we will delete it promptly.
          </p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. If changes are material, we will notify
            you by email or by displaying a notice in the app. Continued use of SplitMate after a policy
            update constitutes acceptance of the revised terms.
          </p>
        </Section>

        <Section title="9. Contact us">
          <p>
            Questions or requests regarding this Privacy Policy can be sent to{" "}
            <a
              href="mailto:info@splitmate.co.in"
              className="text-indigo-600 hover:underline font-medium"
            >
              info@splitmate.co.in
            </a>
            .
          </p>
        </Section>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        <span>© 2026 SplitMate</span>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:text-gray-600">Terms</Link>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="font-medium text-gray-800 mb-1">{title}</h3>
      <div className="text-gray-600">{children}</div>
    </div>
  );
}
