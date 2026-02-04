import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield,
  CheckCircle,
  Search,
  FileText,
  Award,
  Users,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Authenticity Guarantee | Auction House",
  description: "Our commitment to authenticity and how we protect buyers.",
};

const verificationSteps = [
  {
    icon: Search,
    title: "Expert Review",
    description:
      "Every item is examined by our specialists who research provenance, construction, and period characteristics.",
  },
  {
    icon: FileText,
    title: "Documentation",
    description:
      "We compile condition reports, provenance records, and any available certificates or authentication documents.",
  },
  {
    icon: Users,
    title: "Specialist Consensus",
    description:
      "Complex items are reviewed by multiple experts to ensure accurate attribution and dating.",
  },
  {
    icon: Award,
    title: "Guarantee Issued",
    description:
      "Authenticated items are offered with our written guarantee, valid for 5 years from the date of sale.",
  },
];

export default function AuthenticityPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      <PageHero
        title="Authenticity Guarantee"
        subtitle="Our promise: Every item we sell is genuine, or your money back."
      />

      {/* Trust Banner */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center md:text-left">
            <Shield className="h-12 w-12" />
            <div>
              <h2 className="text-2xl font-semibold">5-Year Authenticity Guarantee</h2>
              <p className="opacity-90 mt-1">
                If any item is proven inauthentic, we'll provide a full refund.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Section>
        <div className="mx-auto max-w-3xl prose prose-gray">
          <h2>Our Commitment</h2>
          <p>
            At Auction House, authenticity isn't just a policy—it's the foundation of our
            business. We understand that when you bid on an item, you're trusting our
            expertise and reputation. We take that trust seriously.
          </p>
          <p>
            Every item we offer has been carefully vetted by our team of specialists.
            We stand behind our attributions with a written guarantee that protects your
            purchase for five years.
          </p>
        </div>
      </Section>

      <Section background="alt">
        <SectionHeader
          title="How We Verify Authenticity"
          subtitle="Our rigorous process ensures you can bid with confidence."
          align="center"
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {verificationSteps.map((step, index) => (
            <Card key={index} className="border-border/50 text-center">
              <CardContent className="p-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="mt-1 text-sm font-medium text-primary">
                  Step {index + 1}
                </div>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl prose prose-gray">
          <h2>What's Covered</h2>
          <p>Our authenticity guarantee covers:</p>
          <ul>
            <li>
              <strong>Attribution:</strong> The item is by the stated artist, maker, or
              manufacturer
            </li>
            <li>
              <strong>Period:</strong> The item dates to the stated era or time period
            </li>
            <li>
              <strong>Material:</strong> The item is made of the materials described
            </li>
            <li>
              <strong>Origin:</strong> The item originates from the stated region or culture
            </li>
          </ul>

          <h2>Making a Claim</h2>
          <p>
            If you believe an item is not authentic as described, you must notify us in
            writing within 5 years of the purchase date. To make a claim:
          </p>
          <ol>
            <li>Contact us at authenticity@auctionhouse.com with your lot details</li>
            <li>Provide supporting evidence from a recognized expert or institution</li>
            <li>Return the item in its original condition at your expense</li>
            <li>Our specialists will review the claim within 30 days</li>
          </ol>

          <h2>If Your Claim Is Approved</h2>
          <p>
            If we determine the item is not authentic as described, we will refund
            the full purchase price including the buyer's premium. The refund will be
            processed to your original payment method within 10 business days.
          </p>

          <h2>Limitations</h2>
          <p>The guarantee does not cover:</p>
          <ul>
            <li>Changes in scholarly opinion about attribution</li>
            <li>Condition issues or damage</li>
            <li>Items sold with qualified terms (e.g., "attributed to," "manner of")</li>
            <li>Scientific dating that differs from catalog estimates</li>
            <li>Items that have been altered, restored, or damaged after sale</li>
          </ul>

          <Card className="not-prose my-8 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">5-Year Protection</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Our guarantee extends for 5 years from the date of sale—one of the
                    most comprehensive protections in the industry.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section background="alt">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Questions About Authenticity?</h2>
          <p className="mt-4 text-muted-foreground">
            Our specialists are happy to discuss any item in detail before you bid.
            We encourage you to ask questions—it's part of our commitment to transparency.
          </p>
          <Link href="/contact">
            <Button className="mt-6 gap-2">
              Contact Our Specialists
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
