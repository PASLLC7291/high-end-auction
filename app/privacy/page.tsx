import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { PageHero, Section } from "@/components/trust/section-header";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Auction House",
  description: "How we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      <PageHero
        title="Privacy Policy"
        subtitle="Your privacy is important to us. This policy explains how we handle your data."
      />

      <Section>
        <div className="mx-auto max-w-3xl prose prose-gray">
          <p className="text-muted-foreground">Last updated: February 2024</p>

          <h2>1. Information We Collect</h2>

          <h3>1.1 Information You Provide</h3>
          <p>When you register for an account or use our services, we collect:</p>
          <ul>
            <li>Name and contact information (email, phone, address)</li>
            <li>Payment information (processed securely via Stripe)</li>
            <li>Bidding and purchase history</li>
            <li>Communications with our team</li>
          </ul>

          <h3>1.2 Information Collected Automatically</h3>
          <p>When you use our website, we automatically collect:</p>
          <ul>
            <li>IP address and device information</li>
            <li>Browser type and settings</li>
            <li>Pages visited and actions taken</li>
            <li>Referring website or source</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Process bids and transactions</li>
            <li>Communicate about auctions and your account</li>
            <li>Prevent fraud and ensure security</li>
            <li>Improve our services</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2>3. Information Sharing</h2>
          <p>We do not sell your personal information. We may share information with:</p>
          <ul>
            <li><strong>Service providers:</strong> Payment processors, shipping companies, and IT services that help us operate</li>
            <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
            <li><strong>Business transfers:</strong> In connection with a merger or acquisition</li>
          </ul>

          <h2>4. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your information:
          </p>
          <ul>
            <li>256-bit SSL encryption for all data transmission</li>
            <li>PCI DSS compliant payment processing</li>
            <li>Regular security audits and monitoring</li>
            <li>Access controls and employee training</li>
          </ul>

          <h2>5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access and receive a copy of your data</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your data</li>
            <li>Opt out of marketing communications</li>
            <li>Object to certain processing activities</li>
          </ul>

          <h2>6. Cookies</h2>
          <p>
            We use cookies and similar technologies to enhance your experience. See our{" "}
            <Link href="/privacy#cookies" className="text-primary hover:underline">
              Cookie Policy
            </Link>{" "}
            for details on how we use cookies and how to manage your preferences.
          </p>

          <h2>7. Data Retention</h2>
          <p>
            We retain your information for as long as necessary to provide our services and
            comply with legal obligations. Transaction records are kept for 7 years for
            tax and legal purposes.
          </p>

          <h2>8. International Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries outside your
            country of residence. We ensure appropriate safeguards are in place for such
            transfers.
          </p>

          <h2>9. Children's Privacy</h2>
          <p>
            Our services are not directed to children under 18. We do not knowingly collect
            information from children. If you believe we have collected information from a
            child, please contact us immediately.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of significant
            changes by email or through our website.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            For privacy-related questions or to exercise your rights, please{" "}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>{" "}
            or email privacy@auctionhouse.com.
          </p>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
