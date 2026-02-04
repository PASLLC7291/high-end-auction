import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { PageHero, Section } from "@/components/trust/section-header";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export const metadata = {
  title: "Cookie Policy | Auction House",
  description: "How we use cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      <PageHero
        title="Cookie Policy"
        subtitle="This policy explains how we use cookies and similar technologies."
      />

      <Section>
        <div className="mx-auto max-w-3xl prose prose-gray">
          <p className="text-muted-foreground">Last updated: February 2024</p>

          <h2>What Are Cookies?</h2>
          <p>
            Cookies are small text files stored on your device when you visit our website.
            They help us recognize you and remember your preferences, making your experience
            better and more secure.
          </p>

          <h2>Types of Cookies We Use</h2>

          <Card className="not-prose mb-6 border-border/50">
            <CardContent className="p-6">
              <h3 className="font-medium mb-2">Essential Cookies</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Required for the website to function properly. Cannot be disabled.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Session management and authentication</li>
                <li>• Security features and fraud prevention</li>
                <li>• Shopping cart and bidding functionality</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="not-prose mb-6 border-border/50">
            <CardContent className="p-6">
              <h3 className="font-medium mb-2">Functional Cookies</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Remember your preferences and settings.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Language and region preferences</li>
                <li>• Display settings and layout choices</li>
                <li>• Previously viewed items</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="not-prose mb-6 border-border/50">
            <CardContent className="p-6">
              <h3 className="font-medium mb-2">Analytics Cookies</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Help us understand how visitors interact with our website.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Pages visited and time spent</li>
                <li>• Traffic sources and navigation paths</li>
                <li>• Error tracking and performance monitoring</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="not-prose mb-6 border-border/50">
            <CardContent className="p-6">
              <h3 className="font-medium mb-2">Marketing Cookies</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Used to deliver relevant advertisements.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Personalized auction recommendations</li>
                <li>• Remarketing on other platforms</li>
                <li>• Measuring advertising effectiveness</li>
              </ul>
            </CardContent>
          </Card>

          <h2>Managing Cookies</h2>
          <p>
            You can manage your cookie preferences in several ways:
          </p>
          <ul>
            <li>
              <strong>Browser settings:</strong> Most browsers allow you to refuse or delete
              cookies through their settings menu
            </li>
            <li>
              <strong>Our cookie banner:</strong> When you first visit, you can choose which
              non-essential cookies to accept
            </li>
            <li>
              <strong>Third-party opt-outs:</strong> Many advertising networks offer opt-out
              tools on their websites
            </li>
          </ul>

          <p>
            Please note that disabling certain cookies may affect the functionality of our
            website.
          </p>

          <h2>Third-Party Cookies</h2>
          <p>We use services from third parties that may set their own cookies:</p>
          <ul>
            <li>Google Analytics (analytics)</li>
            <li>Stripe (payment processing)</li>
            <li>Meta/Facebook (advertising)</li>
          </ul>

          <h2>Updates to This Policy</h2>
          <p>
            We may update this Cookie Policy from time to time. Any changes will be posted
            on this page with an updated revision date.
          </p>

          <h2>Contact Us</h2>
          <p>
            If you have questions about our use of cookies, please{" "}
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
