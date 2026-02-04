import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { PageHero, Section } from "@/components/trust/section-header";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Auction House",
  description: "Terms and conditions for using Auction House services.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      <PageHero
        title="Terms of Service"
        subtitle="Please read these terms carefully before using our services."
      />

      <Section>
        <div className="mx-auto max-w-3xl prose prose-gray">
          <p className="text-muted-foreground">Last updated: February 2024</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using Auction House ("we," "our," or "us"), you agree to be bound
            by these Terms of Service and all applicable laws and regulations. If you do not
            agree with any of these terms, you are prohibited from using or accessing this site.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            To use our services, you must be at least 18 years old and capable of forming
            legally binding contracts. By registering for an account, you represent and warrant
            that you meet these eligibility requirements.
          </p>

          <h2>3. Account Registration</h2>
          <p>
            To bid on auctions, you must create an account and provide accurate, complete, and
            current information. You are responsible for maintaining the confidentiality of your
            account credentials and for all activities that occur under your account.
          </p>
          <ul>
            <li>You must provide valid contact information</li>
            <li>You must provide valid payment information before bidding</li>
            <li>You are responsible for keeping your account secure</li>
            <li>You must notify us immediately of any unauthorized use</li>
          </ul>

          <h2>4. Bidding</h2>
          <p>
            All bids placed through our platform are binding offers to purchase. By placing a
            bid, you agree to:
          </p>
          <ul>
            <li>Honor your bid if you are the winning bidder</li>
            <li>Pay the hammer price plus buyer's premium and applicable taxes</li>
            <li>Complete payment within the specified timeframe</li>
            <li>Arrange for collection or pay shipping costs</li>
          </ul>

          <h3>4.1 Bid Increments</h3>
          <p>
            All bids must meet minimum bid increments as displayed on each lot. The system will
            automatically reject bids that do not meet these requirements.
          </p>

          <h3>4.2 Maximum Bids</h3>
          <p>
            Our max bid system allows you to set the maximum amount you're willing to pay. The
            system will bid on your behalf up to your maximum, using only the minimum increment
            necessary to maintain the winning position.
          </p>

          <h2>5. Buyer's Premium</h2>
          <p>
            A buyer's premium of 25% will be added to the hammer price. This premium helps cover
            the costs of cataloging, marketing, and administering the sale. See our{" "}
            <Link href="/buyers-premium" className="text-primary hover:underline">
              Buyer's Premium Policy
            </Link>{" "}
            for details.
          </p>

          <h2>6. Payment</h2>
          <p>
            Payment is due within 7 business days of the auction's close. We accept major credit
            cards, debit cards, and bank transfers. Failure to complete payment may result in:
          </p>
          <ul>
            <li>Suspension or termination of your account</li>
            <li>Legal action to recover amounts owed</li>
            <li>Sale of the item to another bidder</li>
          </ul>

          <h2>7. Shipping and Collection</h2>
          <p>
            Buyers are responsible for all shipping and handling costs. Items must be collected
            or shipping arranged within 14 days of payment. Storage fees may apply for items
            not collected within this timeframe.
          </p>

          <h2>8. Returns and Refunds</h2>
          <p>
            Due to the nature of auction sales, all sales are final. Returns are only accepted
            if an item is proven to be materially different from its catalog description. See
            our{" "}
            <Link href="/returns" className="text-primary hover:underline">
              Returns Policy
            </Link>{" "}
            for details.
          </p>

          <h2>9. Authenticity Guarantee</h2>
          <p>
            We guarantee the authenticity of all items as described. If an item is proven to be
            counterfeit within 5 years of purchase, we will provide a full refund. See our{" "}
            <Link href="/authenticity" className="text-primary hover:underline">
              Authenticity Guarantee
            </Link>{" "}
            for details.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Auction House shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages arising from your
            use of our services.
          </p>

          <h2>11. Privacy</h2>
          <p>
            Your use of our services is also governed by our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            , which describes how we collect, use, and protect your personal information.
          </p>

          <h2>12. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. Changes will be effective
            immediately upon posting. Your continued use of our services after changes
            constitutes acceptance of the modified terms.
          </p>

          <h2>13. Contact Us</h2>
          <p>
            If you have any questions about these Terms of Service, please{" "}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>
            .
          </p>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
