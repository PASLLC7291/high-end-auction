import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { PageHero, Section } from "@/components/trust/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Returns Policy | Auction House",
  description: "Our policy on returns, refunds, and disputes.",
};

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      <PageHero
        title="Returns Policy"
        subtitle="Understanding our policy on returns and refunds."
      />

      <Section>
        <div className="mx-auto max-w-3xl prose prose-gray">
          <Card className="not-prose mb-8 border-amber-200 bg-amber-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-900">Important Notice</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Due to the nature of auction sales, all purchases are generally final.
                    Please inspect catalog descriptions and condition reports carefully
                    before bidding.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h2>General Policy</h2>
          <p>
            All sales at Auction House are final. By placing a bid, you acknowledge that
            you have reviewed the lot description, images, and any available condition
            reports, and agree to purchase the item as described.
          </p>

          <h2>When Returns Are Accepted</h2>
          <p>
            Returns may be considered in the following limited circumstances:
          </p>

          <Card className="not-prose my-6 border-border/50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Material Misrepresentation</h4>
                  <p className="text-sm text-muted-foreground">
                    The item is materially different from the catalog description in a way
                    that significantly affects its value.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Authenticity Issues</h4>
                  <p className="text-sm text-muted-foreground">
                    The item is proven to be counterfeit or not as attributed. See our{" "}
                    <Link href="/authenticity" className="text-primary hover:underline">
                      Authenticity Guarantee
                    </Link>
                    .
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium">Shipping Damage</h4>
                  <p className="text-sm text-muted-foreground">
                    Damage that occurred during shipping (must be reported within 48 hours
                    of delivery with photos).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h2>What's Not Covered</h2>
          <Card className="not-prose my-6 border-border/50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Change of Mind</h4>
                  <p className="text-sm text-muted-foreground">
                    Buyer's remorse or deciding you no longer want the item.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Condition Issues Noted in Description</h4>
                  <p className="text-sm text-muted-foreground">
                    Wear, damage, or restoration already described in the catalog.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Size or Color Variations</h4>
                  <p className="text-sm text-muted-foreground">
                    Minor variations in color, size, or appearance from photos.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Third-Party Opinions</h4>
                  <p className="text-sm text-muted-foreground">
                    Disagreement by another appraiser about attribution or value.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h2>Return Process</h2>
          <p>If you believe you have grounds for a return:</p>
          <ol>
            <li>
              <strong>Contact us within 7 days</strong> of receiving your item. Email
              returns@auctionhouse.com with your lot number and reason for the claim.
            </li>
            <li>
              <strong>Provide documentation.</strong> Include photos and any supporting
              evidence for your claim.
            </li>
            <li>
              <strong>Await review.</strong> Our team will review your claim and respond
              within 5 business days.
            </li>
            <li>
              <strong>If approved,</strong> we will provide return shipping instructions.
              The item must be returned in its original condition.
            </li>
          </ol>

          <h2>Refunds</h2>
          <p>
            Approved refunds will be processed to your original payment method within
            10 business days of receiving the returned item. Refunds include the hammer
            price and buyer's premium. Shipping costs are non-refundable unless the
            return is due to our error.
          </p>

          <Card className="not-prose my-8 border-border/50 bg-section-alt">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <HelpCircle className="h-6 w-6 text-muted-foreground shrink-0" />
                <div>
                  <h3 className="font-medium">Questions About a Purchase?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Before requesting a return, we encourage you to{" "}
                    <Link href="/contact" className="text-primary hover:underline">
                      contact our client services team
                    </Link>
                    . Many issues can be resolved without a formal return process.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
