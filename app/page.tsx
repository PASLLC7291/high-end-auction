import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  ArrowRight,
  Shield,
  Award,
  Users,
  TrendingUp,
  Search,
  CreditCard,
  Gavel,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

import { DateTime } from "luxon";
import { getClientApiClient } from "@/lib/basta-client";
import { clientApiSchema } from "@bastaai/basta-js";
import { TrustBar } from "@/components/trust";
import { StatusBadge } from "@/components/trust/badges";
import { TestimonialCard } from "@/components/trust/testimonial-card";
import { Section, SectionHeader } from "@/components/trust/section-header";
import { getAuctionCardImage } from "@/lib/cloudinary";

type Auction = {
  id: string;
  title: string | undefined;
  dates: {
    openDate: string | undefined;
    closingDate: string | undefined;
  };
  status: clientApiSchema.SaleStatus | undefined;
  image: string | undefined;
  lotsCount: number | undefined;
};

// Filter out test/dev auctions
const TEST_KEYWORDS = ["test", "e2e", "debug", "headless"];

function isTestAuction(title: string | undefined | null): boolean {
  if (!title) return true;
  const lowerTitle = title.toLowerCase();
  return TEST_KEYWORDS.some((keyword) => lowerTitle.includes(keyword));
}

async function getAuctions(): Promise<Auction[]> {
  const accountId = process.env.ACCOUNT_ID?.trim();
  if (!accountId) {
    console.error("Missing env variable: ACCOUNT_ID");
    return [];
  }
  const client = getClientApiClient();

  try {
    const sales = await client.query({
      sales: {
        __args: {
          accountId,
          first: 20,
          filter: {
            statuses: ["PUBLISHED", "OPENED", "LIVE", "CLOSING", "CLOSED", "PROCESSING", "PAUSED"],
          },
        },
        edges: {
          node: {
            id: true,
            title: true,
            images: { url: true },
            status: true,
            dates: { openDate: true, closingDate: true },
            items: {
              pageInfo: { totalRecords: true },
              edges: { node: { images: { url: true } } },
            },
          },
        },
      },
    });

    return sales.sales.edges
      .filter(({ node: sale }) => !isTestAuction(sale.title))
      .map(({ node: sale }) => {
        const saleImage = sale.images?.[0]?.url;
        const firstItemImage = sale.items.edges?.[0]?.node?.images?.[0]?.url;

        return {
          id: sale.id,
          title: sale.title ?? undefined,
          dates: {
            openDate: sale.dates.openDate ?? undefined,
            closingDate: sale.dates.closingDate ?? undefined,
          },
          status: sale.status,
          image: saleImage || firstItemImage || undefined,
          lotsCount: sale.items.pageInfo.totalRecords,
        };
      });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return [];
  }
}

// How it works steps
const howItWorksSteps = [
  {
    step: 1,
    icon: Search,
    title: "Browse & Discover",
    description: "Explore our curated auctions featuring authenticated art, antiques, and collectibles.",
  },
  {
    step: 2,
    icon: CreditCard,
    title: "Register & Verify",
    description: "Create an account and add a payment method to start bidding with confidence.",
  },
  {
    step: 3,
    icon: Gavel,
    title: "Bid & Win",
    description: "Place bids in real-time. If you win, we handle secure payment and shipping.",
  },
];

// Featured testimonials
const testimonials = [
  {
    quote: "The expertise and transparency made selling my collection a seamless experience. Highly recommend.",
    author: "Margaret Chen",
    title: "Private Collector",
    location: "San Francisco, CA",
  },
  {
    quote: "As a first-time buyer, I appreciated the detailed condition reports and responsive support throughout the process.",
    author: "David Park",
    title: "Art Enthusiast",
    location: "New York, NY",
  },
  {
    quote: "Professional, knowledgeable, and trustworthy. They've handled multiple consignments for our estate with excellent results.",
    author: "Sarah Thompson",
    title: "Estate Executor",
    location: "Boston, MA",
  },
];

function getStatusType(status: clientApiSchema.SaleStatus | undefined): "live" | "closing" | "open" | "upcoming" | "closed" {
  switch (status) {
    case "LIVE":
      return "live";
    case "CLOSING":
      return "closing";
    case "OPENED":
      return "open";
    case "CLOSED":
    case "PROCESSING":
      return "closed";
    default:
      return "upcoming";
  }
}

export default async function HomePage() {
  const allAuctions = await getAuctions();
  const now = DateTime.now();

  // Active auctions (live, closing, or open)
  const activeAuctions = allAuctions
    .filter((a) => ["OPENED", "LIVE", "CLOSING"].includes(a.status || ""))
    .slice(0, 3);

  // Upcoming auctions
  const upcomingAuctions = allAuctions
    .filter((a) => a.status === "PUBLISHED")
    .slice(0, 3);

  // Featured auctions to display
  const featuredAuctions = activeAuctions.length > 0 ? activeAuctions : upcomingAuctions;

  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50 bg-section-alt">
        <div className="container mx-auto px-4 py-20 md:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance">
              A Trusted Marketplace for
              <span className="block text-primary">Fine Art & Collectibles</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Expert curation, authenticated items, and transparent bidding.
              Join thousands of collectors who trust us for exceptional pieces
              and outstanding service.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/auctions">
                <Button size="lg" className="gap-2">
                  Browse Auctions
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button variant="outline" size="lg">
                  How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <TrustBar
        metrics={[
          { value: "Est. 2020", label: "Trusted Since", icon: <Shield className="h-5 w-5" /> },
          { value: "500+", label: "Auctions Held", icon: <Award className="h-5 w-5" /> },
          { value: "$10M+", label: "Total Sales", icon: <TrendingUp className="h-5 w-5" /> },
          { value: "5,000+", label: "Happy Bidders", icon: <Users className="h-5 w-5" /> },
        ]}
      />

      {/* Featured Auctions */}
      <Section>
        <SectionHeader
          title="Featured Auctions"
          subtitle="Discover our current and upcoming sales featuring exceptional pieces from trusted consignors."
          align="center"
        />

        {featuredAuctions.length === 0 ? (
          <Card className="mx-auto max-w-md border-border/50">
            <CardContent className="py-12 text-center">
              <Gavel className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4">No Active Auctions</h3>
              <p className="mt-2 text-muted-foreground">
                New sales are announced regularly. Subscribe to our newsletter for updates.
              </p>
              <Link href="/auctions">
                <Button variant="outline" className="mt-6">
                  View All Auctions
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredAuctions.map((auction) => {
                const openDate = auction.dates.openDate
                  ? DateTime.fromISO(auction.dates.openDate)
                  : undefined;

                return (
                  <Link key={auction.id} href={`/auction/${auction.id}`}>
                    <Card className="group h-full overflow-hidden border-border/50 transition-all duration-200 hover:border-border hover:shadow-lg">
                      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                        {auction.image ? (
                          <img
                            src={getAuctionCardImage(auction.image)}
                            alt={auction.title || "Auction"}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Gavel className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute right-3 top-3">
                          <StatusBadge status={getStatusType(auction.status)} />
                        </div>
                      </div>
                      <CardContent className="p-5">
                        <h3 className="line-clamp-2 text-lg font-medium leading-snug">
                          {auction.title || "Untitled Auction"}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            <span>{openDate ? openDate.toFormat("MMM d, yyyy") : "TBA"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{openDate ? openDate.toFormat("h:mm a") : "TBA"}</span>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Lots
                            </p>
                            <p className="mt-0.5 font-medium">{auction.lotsCount || 0}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="gap-1">
                            View Auction
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
            <div className="mt-10 text-center">
              <Link href="/auctions">
                <Button variant="outline" size="lg">
                  View All Auctions
                </Button>
              </Link>
            </div>
          </>
        )}
      </Section>

      {/* How It Works */}
      <Section background="alt">
        <SectionHeader
          title="How It Works"
          subtitle="Bidding with us is simple, secure, and transparent."
          align="center"
        />
        <div className="grid gap-8 md:grid-cols-3">
          {howItWorksSteps.map((step) => (
            <div key={step.step} className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <step.icon className="h-7 w-7 text-primary" />
              </div>
              <div className="mt-2 text-sm font-medium text-primary">Step {step.step}</div>
              <h3 className="mt-2">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/how-it-works">
            <Button variant="outline">
              Learn More
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* Why Trust Us */}
      <Section>
        <SectionHeader
          title="Why Collectors Trust Us"
          subtitle="We're committed to authenticity, transparency, and exceptional service."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Shield,
              title: "Authenticity Guaranteed",
              description: "Every item is vetted by our specialists with detailed condition reports.",
            },
            {
              icon: CheckCircle,
              title: "Transparent Bidding",
              description: "Real-time updates, clear buyer's premium, and no hidden fees.",
            },
            {
              icon: Users,
              title: "Expert Support",
              description: "We're available to answer questions and guide your experience.",
            },
            {
              icon: Award,
              title: "Proven Track Record",
              description: "500+ successful auctions and thousands of satisfied collectors.",
            },
          ].map((feature, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Testimonials */}
      <Section background="alt">
        <SectionHeader
          title="What Our Clients Say"
          subtitle="Hear from collectors and consignors who've worked with us."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} testimonial={testimonial} />
          ))}
        </div>
      </Section>

      {/* CTA Section */}
      <Section background="highlight" size="lg">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Ready to Sell?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our specialists provide complimentary valuations and guide you through
            the consignment process. Let's find your collection a new home.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/consign">
              <Button size="lg">
                Request a Valuation
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
