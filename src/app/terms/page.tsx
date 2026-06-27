import Link from "next/link";

export const metadata = {
  title: "Terms of Service — SplitMate",
  description: "The terms and conditions for using SplitMate.",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: 25 June 2026</p>

        <Section title="1. Acceptance of terms">
          <p>
            By accessing or using SplitMate (&quot;the Service&quot;), you agree to be bound by these Terms of
            Service. If you do not agree to these terms, do not use the Service. These terms apply to all
            visitors, users, and others who access or use the Service.
          </p>
        </Section>

        <Section title="2. What SplitMate is">
          <p>
            SplitMate is an expense-tracking tool designed to help roommates and groups log shared costs
            and calculate who owes whom. It is a convenience tool — not a financial institution, payment
            processor, or legal accounting service. SplitMate does not hold, transfer, or guarantee any
            money.
          </p>
          <p>
            All financial settlements between users happen outside the app (cash, UPI, bank transfer, etc.).
            SplitMate only records what users choose to enter.
          </p>
        </Section>

        <Section title="3. Account registration">
          <p>
            Accounts are created and managed through Clerk. You are responsible for maintaining the security
            of your account credentials and for all activity that occurs under your account. If you discover
            any unauthorised use of your account, notify us at{" "}
            <a href="mailto:info@splitmate.co.in" className="text-indigo-600 hover:underline">
              info@splitmate.co.in
            </a>{" "}
            immediately.
          </p>
          <p>
            You must be at least 13 years old to use SplitMate.
          </p>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree not to use SplitMate to:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Record fraudulent, fictitious, or misleading expenses to deceive other room members</li>
            <li>Harass, impersonate, or harm other users</li>
            <li>Attempt to gain unauthorised access to another user's rooms or data</li>
            <li>Use the Service in any way that violates applicable Indian or local laws</li>
            <li>Reverse-engineer, scrape, or otherwise exploit the Service's API beyond its intended use</li>
          </ul>
          <p className="mt-3">
            We reserve the right to suspend or terminate accounts that violate these terms without notice.
          </p>
        </Section>

        <Section title="5. User content">
          <p>
            You own the data you enter into SplitMate (expense titles, amounts, notes, etc.). By using the
            Service, you grant us a limited licence to store and process that data solely for the purpose
            of operating the Service on your behalf.
          </p>
          <p>
            You are responsible for the accuracy of the data you enter. Other room members can see data
            you add to shared rooms — only join rooms with people you trust.
          </p>
        </Section>

        <Section title="6. No financial advice">
          <p>
            Nothing in SplitMate constitutes financial, tax, or legal advice. The balance calculations are
            a convenience tool based on data you enter. We make no guarantee that the numbers are legally
            binding or admissible in any dispute. For matters involving significant sums or disputes, seek
            qualified professional advice.
          </p>
        </Section>

        <Section title="7. Availability and changes">
          <p>
            We aim to keep SplitMate available at all times but do not guarantee uninterrupted access. We
            may modify, suspend, or discontinue features at any time. When practical, we will give advance
            notice of significant changes.
          </p>
          <p>
            We may update these Terms of Service from time to time. Material changes will be communicated
            by email or via an in-app notice. Continued use of the Service after changes take effect
            constitutes acceptance.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            To the maximum extent permitted by applicable law, SplitMate and its operators shall not be
            liable for any indirect, incidental, special, or consequential damages arising from your use
            of the Service, including disputes between room members over expense records.
          </p>
          <p>
            Our total liability to you for any claim arising out of or related to these Terms or the
            Service shall not exceed ₹1,000 (one thousand Indian Rupees).
          </p>
        </Section>

        <Section title="9. Governing law">
          <p>
            These Terms are governed by the laws of India. Any disputes arising from these Terms or your
            use of the Service shall be subject to the exclusive jurisdiction of the courts of Hyderabad,
            Telangana, India.
          </p>
        </Section>

        <Section title="10. Contact us">
          <p>
            Questions about these Terms can be sent to{" "}
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
