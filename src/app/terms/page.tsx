export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[#1B365D] mb-6">Terms of Service</h1>

        <div className="prose prose-slate">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Service Description</h2>
            <p className="text-[#7F8C8D]">
              TrustCircle provides verified community presence badges. The service confirms
              that a device regularly sleeps at a specific neighborhood location without
              collecting any personal information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Subscription</h2>
            <ul className="list-disc pl-6 text-[#7F8C8D] space-y-2">
              <li>Monthly subscription: $0.99/month</li>
              <li>Billed automatically each month via Stripe</li>
              <li>Cancel anytime through Settings</li>
              <li>No refunds for partial months</li>
              <li>Subsidized access available through community vouching</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Verification Requirements</h2>
            <p className="text-[#7F8C8D] mb-4">
              To receive a verified badge, your device must:
            </p>
            <ul className="list-disc pl-6 text-[#7F8C8D] space-y-2">
              <li>Be present at the registered neighborhood for 14 nights during verification</li>
              <li>Show human movement patterns on at least 10 of those 14 days</li>
              <li>Continue to meet presence requirements (20 of 30 nights) after verification</li>
              <li>Continue to show movement (20 of 30 days) after verification</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Badge Revocation</h2>
            <p className="text-[#7F8C8D] mb-4">
              Your badge may be revoked if:
            </p>
            <ul className="list-disc pl-6 text-[#7F8C8D] space-y-2">
              <li>Your badge fails verification when scanned</li>
              <li>You fail to maintain presence requirements for 30 consecutive days</li>
              <li>You fail to show movement for 7 consecutive days</li>
              <li>Your payment fails and is not resolved within 3 days</li>
              <li>You attempt to circumvent the verification system</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Device Blacklist</h2>
            <p className="text-[#7F8C8D]">
              Devices that are revoked due to failed badge scans or repeated verification
              failures may be permanently blacklisted from the service. Blacklisted devices
              cannot register for TrustCircle in any neighborhood.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">PIN Responsibility</h2>
            <p className="text-[#7F8C8D]">
              You are responsible for keeping your 6-digit PIN secure. We cannot recover
              your PIN if you forget it. Lost PINs require account cancellation and
              re-registration.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Incident Reporting</h2>
            <p className="text-[#7F8C8D]">
              Incident reports are anonymous and expire after 24 hours. False or malicious
              reporting may result in restrictions on your ability to submit reports.
              Maximum 3 reports per 24 hours, 10 per month.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Vouching</h2>
            <p className="text-[#7F8C8D]">
              Verified residents may vouch for up to 3 subsidized members per year.
              Vouching accounts must be at least 30 days old. Vouching does not
              guarantee subsidy approval.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Disclaimer</h2>
            <p className="text-[#7F8C8D]">
              TrustCircle provides presence verification only. A verified badge does not
              constitute a background check, character reference, or guarantee of safety.
              Users should exercise normal judgment when interacting with others.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#2C3E50] mb-3">Changes</h2>
            <p className="text-[#7F8C8D]">
              We may update these terms. Continued use of the service constitutes
              acceptance of updated terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
