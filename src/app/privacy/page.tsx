export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1B365D] mb-6">Privacy Policy</h1>

        <div className="prose prose-slate">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Zero Personal Data</h2>
            <p className="text-[#7F8C8D] mb-4">
              TrustCircle is designed from the ground up to collect zero personal data.
              We do not collect, store, or process:
            </p>
            <ul className="list-disc pl-6 text-[#7F8C8D] space-y-2">
              <li>Names</li>
              <li>Email addresses</li>
              <li>Phone numbers</li>
              <li>Physical addresses</li>
              <li>Photos or images (incident photos are encrypted and deleted after 24 hours)</li>
              <li>IP addresses</li>
              <li>Precise location coordinates</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">What We Do Collect</h2>
            <p className="text-[#7F8C8D] mb-4">
              We collect only anonymous, non-identifiable data necessary for the service:
            </p>
            <ul className="list-disc pl-6 text-[#7F8C8D] space-y-2">
              <li>Anonymous device tokens (cryptographic hashes that cannot identify you)</li>
              <li>Location hashes (your precise location is hashed on your device before transmission)</li>
              <li>Movement detection results (only &quot;yes&quot; or &quot;no&quot; — no actual sensor data)</li>
              <li>Zone membership (which neighborhood you belong to)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Payment Information</h2>
            <p className="text-[#7F8C8D]">
              Payment processing is handled entirely by Stripe. We never see or store your
              credit card information. We only receive a customer ID from Stripe to manage
              your subscription.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">PIN Security</h2>
            <p className="text-[#7F8C8D]">
              Your 6-digit PIN is hashed and stored only on your device. It is never
              transmitted to our servers. If you forget your PIN, we cannot recover it
              because we never had it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Data Retention</h2>
            <ul className="list-disc pl-6 text-[#7F8C8D] space-y-2">
              <li>Incident reports: Deleted after 24 hours</li>
              <li>Presence logs: Deleted after 45 days</li>
              <li>Movement logs: Deleted after 45 days</li>
              <li>Account data: Deleted 7 days after subscription cancellation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">If We Get Hacked</h2>
            <p className="text-[#7F8C8D]">
              If an attacker gains access to our database, they would find only anonymous
              device tokens mapped to neighborhood zones. This data cannot identify, locate,
              or target any individual. The data is architecturally worthless to attackers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Contact</h2>
            <p className="text-[#7F8C8D]">
              Questions about privacy? Contact us at privacy@trustcircle.io
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
