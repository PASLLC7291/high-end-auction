import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Calculator, HelpCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Buyer's Premium | Auction House",
  description: "Understanding the buyer's premium and how it's calculated.",
};

export default function BuyersPremiumPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      <PageHero
        title="Buyer's Premium"
        subtitle="Understanding the costs associated with purchasing at auction."
      />

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            title="What is a Buyer's Premium?"
            subtitle="A buyer's premium is an additional fee added to the hammer price of each lot you win."
          />

          <div className="prose prose-gray max-w-none">
            <p>
              The buyer's premium is a standard practice in the auction industry. It helps
              cover the costs of cataloging, photography, marketing, expert research, and
              administering each sale.
            </p>

            <Card className="not-prose my-8 border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Calculator className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Our Premium Rate</h3>
                    <p className="text-3xl font-bold text-primary mt-2">25%</p>
                    <p className="text-muted-foreground mt-2">
                      Added to the hammer price of each lot
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <h2>Example Calculation</h2>
            <Card className="not-prose my-6 border-border/50">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Hammer Price</span>
                    <span className="font-medium">$1,000</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Buyer's Premium (25%)</span>
                    <span className="font-medium">$250</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Subtotal</span>
                    <span className="font-medium">$1,250</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span>Sales Tax (where applicable)</span>
                    <span className="font-medium">Varies</span>
                  </div>
                  <div className="flex justify-between py-2 text-lg">
                    <span className="font-semibold">Total Due</span>
                    <span className="font-bold text-primary">$1,250+</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <h2>What's Included</h2>
            <p>The buyer's premium supports:</p>

            <div className="not-prose grid gap-4 my-6 sm:grid-cols-2">
              {[
                "Expert cataloging and research",
                "Professional photography",
                "Auction marketing and promotion",
                "Platform and technology costs",
                "Customer service and support",
                "Condition reporting",
                "Secure payment processing",
                "Administrative services",
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            <h2>Additional Costs</h2>
            <p>In addition to the buyer's premium, you may be responsible for:</p>
            <ul>
              <li>
                <strong>Sales tax:</strong> Applicable based on your shipping address and
                local tax laws
              </li>
              <li>
                <strong>Shipping and handling:</strong> Costs vary based on item size,
                destination, and shipping method
              </li>
              <li>
                <strong>Import duties:</strong> For international buyers, customs duties
                and taxes may apply
              </li>
            </ul>

            <Card className="not-prose my-8 border-border/50 bg-section-alt">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <HelpCircle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Have Questions?</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Our team is happy to help you understand the total cost of your
                      purchase before you bid.{" "}
                      <Link href="/contact" className="text-primary hover:underline">
                        Contact us
                      </Link>{" "}
                      or check our{" "}
                      <Link href="/faq" className="text-primary hover:underline">
                        FAQ
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
