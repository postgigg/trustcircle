'use client';

import { useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface FAQItem {
  question: string;
  answer: ReactNode;
}

interface FAQSection {
  title: string;
  icon: ReactNode;
  items: FAQItem[];
}

const faqSections: FAQSection[] = [
  {
    title: 'What is TrustCircle?',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
    items: [
      {
        question: 'What exactly is TrustCircle?',
        answer: 'TrustCircle is a privacy-first neighborhood verification service. It creates a live, verifiable badge that proves you actually live in your neighborhood—without ever storing your name, email, address, or exact location.',
      },
      {
        question: 'How is this different from Nextdoor or other neighborhood apps?',
        answer: 'Most neighborhood apps verify your address using a postcard or utility bill. TrustCircle verifies that you actually live there through behavioral patterns—sleeping at home and natural daily movement. This is much harder to fake and provides stronger proof of residence.',
      },
      {
        question: 'What can I use my TrustCircle badge for?',
        answer: (
          <ul className="list-disc pl-4 space-y-1">
            <li>HOA meetings and community voting</li>
            <li>Buying/selling on local marketplaces with verified neighbors</li>
            <li>Finding trusted pet sitters and dog walkers</li>
            <li>Joining neighborhood fitness groups</li>
            <li>Getting contractor referrals from actual neighbors</li>
            <li>Receiving verified emergency alerts</li>
            <li>Coordinating block parties and community events</li>
          </ul>
        ),
      },
      {
        question: 'Is TrustCircle available in my area?',
        answer: "TrustCircle creates neighborhoods automatically using H3 geospatial indexing. If you can see a zone when you open the app, it's available in your area. We're expanding constantly, so check back if your area isn't covered yet.",
      },
    ],
  },
  {
    title: 'How Verification Works',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    items: [
      {
        question: 'How does the 14-day verification process work?',
        answer: (
          <div className="space-y-3">
            <p>After signing up, we verify your residence over 14 days by checking two things:</p>
            <ol className="list-decimal pl-4 space-y-2">
              <li><strong>Nights at home (14 required):</strong> We check that your phone is in your neighborhood zone during nighttime hours. This proves you sleep there.</li>
              <li><strong>Movement patterns (10 days required):</strong> We detect natural daily activity—walking, driving, commuting. This proves you&apos;re a real person living normally, not a spoofed location.</li>
            </ol>
            <p>Once both requirements are met, your badge activates automatically.</p>
          </div>
        ),
      },
      {
        question: 'What counts as a "night at home"?',
        answer: 'A night at home is counted when your phone is detected in your neighborhood zone during nighttime hours (typically between 10 PM and 6 AM). You don\'t need to be there the entire night—we check periodically and confirm presence.',
      },
      {
        question: 'What is "movement detected"?',
        answer: 'Movement detection confirms you\'re a real person with natural daily patterns, not a spoofed or stationary device. We look for the kinds of movement patterns that indicate normal life—commuting, walking around your home, running errands. This prevents fraud while requiring zero effort from you.',
      },
      {
        question: 'What if I travel or stay somewhere else?',
        answer: 'Short trips (up to 3 nights away) won\'t reset your progress. We understand people travel, visit family, or stay elsewhere occasionally. Longer absences may pause your verification, but you\'ll pick up where you left off when you return.',
      },
      {
        question: 'Can I speed up verification?',
        answer: 'Yes! We offer a Fast-Track option that verifies you instantly. The price starts at $1,500 and decreases by $107 each day of your verification. 75% of Fast-Track payments go to your community pool to sponsor neighbors who can\'t afford the monthly fee.',
      },
    ],
  },
  {
    title: 'Sponsoring & Community Support',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    items: [
      {
        question: 'What is sponsored access?',
        answer: 'Sponsored access lets you join TrustCircle for free by getting vouches from 10 verified neighbors. Instead of paying $0.99/month, your community sponsors your membership. This ensures everyone can participate regardless of financial situation.',
      },
      {
        question: 'How do I get sponsored access?',
        answer: (
          <ol className="list-decimal pl-4 space-y-2">
            <li>Choose "Get sponsored access" on the home page</li>
            <li>Find 10 verified TrustCircle neighbors in your community</li>
            <li>Have each neighbor scan your QR code with their app</li>
            <li>Once you have 10 vouches, you&apos;re in for free!</li>
          </ol>
        ),
      },
      {
        question: 'How do I sponsor (vouch for) a neighbor?',
        answer: 'When a neighbor asks you to vouch for them, they\'ll show you a QR code. Open your TrustCircle app, go to the Verify tab, and scan their code. You\'ll be asked to confirm that you recognize them as part of your community. Each verified member can vouch for up to 10 neighbors per year.',
      },
      {
        question: 'What happens when my sponsored access expires?',
        answer: 'Sponsored access lasts one year. Before it expires, you\'ll need to either collect 10 new vouches from neighbors to renew, or switch to the paid subscription ($0.99/month). We\'ll notify you before your access expires.',
      },
    ],
  },
  {
    title: 'Privacy & Data',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    items: [
      {
        question: 'What data does TrustCircle collect?',
        answer: (
          <div className="space-y-3">
            <p><strong>We collect:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Hashed (one-way encrypted) location checks during verification</li>
              <li>Movement pattern confirmations (not actual paths)</li>
              <li>Device fingerprint (to prevent multi-accounting)</li>
            </ul>
            <p className="mt-3"><strong>We never collect or store:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Your name, email, or phone number</li>
              <li>Your exact address</li>
              <li>Your precise GPS coordinates</li>
              <li>Your movement history or location timeline</li>
            </ul>
          </div>
        ),
      },
      {
        question: 'Can TrustCircle track my location?',
        answer: 'No. We use your location only at specific check-in moments to verify you\'re in your neighborhood zone. We immediately hash (one-way encrypt) this data so your exact location is never stored. We cannot reconstruct where you\'ve been.',
      },
      {
        question: 'What happens to my data if I delete my account?',
        answer: 'When you delete your account, all associated data is permanently removed from our servers. Since we never store personal identifiers, there\'s nothing to link back to you once your account is gone.',
      },
      {
        question: 'Can law enforcement request my data?',
        answer: 'Because we don\'t store personal information, location history, or identifying data, we have nothing meaningful to provide. Your badge is tied to a device, not an identity.',
      },
    ],
  },
  {
    title: 'Pricing',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    items: [
      {
        question: 'How much does TrustCircle cost?',
        answer: 'TrustCircle costs $0.99/month. You can cancel anytime with no penalty. There are no contracts, setup fees, or hidden charges.',
      },
      {
        question: 'Is there a free option?',
        answer: 'Yes! You can get free access through community sponsorship. Collect 10 vouches from verified neighbors and your membership is covered for a year. This ensures TrustCircle is accessible to everyone.',
      },
      {
        question: 'What is Fast-Track and how is it priced?',
        answer: (
          <div className="space-y-2">
            <p>Fast-Track lets you skip the 14-day verification and get verified instantly. Pricing:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Day 1: $1,500</li>
              <li>Price drops $107/day during verification</li>
              <li>Minimum price: $50 (near end of verification)</li>
              <li>75% goes to your community pool to sponsor neighbors</li>
            </ul>
          </div>
        ),
      },
      {
        question: 'How do I cancel my subscription?',
        answer: 'Go to Settings → Manage Subscription to access the billing portal. You can cancel anytime and your badge will remain active until the end of your billing period. No cancellation fees.',
      },
    ],
  },
  {
    title: 'Troubleshooting',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    items: [
      {
        question: 'The app says "TrustCircle isn\'t available in your area yet"',
        answer: 'This means we haven\'t expanded to your neighborhood yet. We\'re growing rapidly—check back soon or sign up for our waitlist to be notified when we launch in your area.',
      },
      {
        question: 'I can\'t enable location access',
        answer: (
          <ol className="list-decimal pl-4 space-y-2">
            <li>Click the lock/info icon in your browser&apos;s address bar</li>
            <li>Find "Location" in the permissions</li>
            <li>Change from "Block" to "Allow"</li>
            <li>Refresh the page</li>
            <li>If on mobile, also check your phone&apos;s system settings for location permissions</li>
          </ol>
        ),
      },
      {
        question: 'I forgot my PIN',
        answer: 'For security, your PIN is stored only on your device and we cannot recover it. If you\'ve forgotten your PIN, you\'ll need to delete your account and re-register. Go to Settings → Delete Account (you\'ll need your PIN for this, or contact support for assistance).',
      },
      {
        question: 'My badge was frozen due to too many PIN attempts',
        answer: 'After 10 failed PIN attempts, your badge is frozen for security. This is permanent and cannot be undone. You\'ll need to contact support to verify your identity and create a new account.',
      },
      {
        question: 'My nights/movement aren\'t being counted',
        answer: (
          <ul className="list-disc pl-4 space-y-1">
            <li>Make sure location permissions are set to "Always Allow" (not just "While Using")</li>
            <li>Disable battery optimization for TrustCircle in your phone settings</li>
            <li>Keep the app installed—background checks require the app to be present</li>
            <li>Make sure you&apos;re actually in your registered zone during nighttime hours</li>
          </ul>
        ),
      },
      {
        question: 'The scanner isn\'t recognizing badges',
        answer: (
          <ul className="list-disc pl-4 space-y-1">
            <li>Make sure you have good lighting—avoid glare on the badge screen</li>
            <li>Hold the camera steady about 6-12 inches from the badge</li>
            <li>Ensure the badge is fully visible within the scanning area</li>
            <li>Ask the badge holder to increase their screen brightness</li>
            <li>The badge must be active and showing live animation to scan</li>
          </ul>
        ),
      },
    ],
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-900 rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-neutral-900 pr-4">{item.question}</span>
        <svg
          className={`w-5 h-5 text-neutral-400 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-4 text-neutral-600 text-sm leading-relaxed">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter FAQ items based on search query
  const filteredSections = searchQuery
    ? faqSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (typeof item.answer === 'string' &&
                item.answer.toLowerCase().includes(searchQuery.toLowerCase()))
          ),
        }))
        .filter((section) => section.items.length > 0)
    : faqSections;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
            </div>
            <span className="text-sm sm:text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-3 text-neutral-500">
            Everything you need to know about TrustCircle
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
          </div>
        </div>

        {/* FAQ Sections */}
        {filteredSections.length > 0 ? (
          <div className="space-y-8">
            {filteredSections.map((section) => (
              <section key={section.title}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-600">
                    {section.icon}
                  </div>
                  <h2 className="text-lg font-bold text-neutral-900">{section.title}</h2>
                </div>
                <div className="bg-white border border-neutral-200 rounded-xl px-4">
                  {section.items.map((item, index) => (
                    <FAQAccordion key={index} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">No results found</h3>
            <p className="text-neutral-500">
              Try searching for something else or browse the categories above.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-neutral-900 font-medium hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Contact Support */}
        <div className="mt-12 p-6 bg-neutral-100 rounded-2xl text-center">
          <h3 className="text-lg font-bold text-neutral-900 mb-2">Still have questions?</h3>
          <p className="text-neutral-600 mb-4">
            Can&apos;t find what you&apos;re looking for? We&apos;re here to help.
          </p>
          <a
            href="mailto:support@trustcircle.app"
            className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white font-semibold rounded-full hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Contact Support
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-neutral-500">
            <a href="/privacy" className="hover:text-neutral-900 transition-colors">Privacy Policy</a>
            <span className="text-neutral-300">|</span>
            <a href="/terms" className="hover:text-neutral-900 transition-colors">Terms of Service</a>
            <span className="text-neutral-300">|</span>
            <a href="/" className="hover:text-neutral-900 transition-colors">Home</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
