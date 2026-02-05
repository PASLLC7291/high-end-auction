import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  CalendarDays,
  History,
  Radio,
  Gavel,
  Shield,
  Award,
  Users,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { DateTime } from "luxon";
import { getClientApiClient } from "@/lib/basta-client";
import { clientApiSchema } from "@bastaai/basta-js";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";
import { StatusBadge } from "@/components/trust/badges";
import { getAuctionCardImage } from "@/lib/cloudinary";

export const metadata = {
  title: "Auctions | Auction House",
  description: "Browse our current and upcoming auctions featuring authenticated fine art, antiques, and collectibles.",
};

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

// Filter out test/dev auctions from display
const TEST_KEYWORDS = ["test", "e2e", "debug", "dropship", "cj dropship", "headless"];

function isTestAuction(title: string | undefined | null): boolean {
  if (!title) return true;
  const lowerTitle = title.toLowerCase();
  return TEST_KEYWORDS.some((keyword) => lowerTitle.includes(keyword));
}

async function getAllAuctions(): Promise<Auction[]> {
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
          first: 100,
          filter: { statuses: ["PUBLISHED", "OPENED", "LIVE", "CLOSING", "CLOSED"] },
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

function AuctionCard({ auction, isPast = false }: { auction: Auction; isPast?: boolean }) {
  const openDate = auction.dates.openDate
    ? DateTime.fromISO(auction.dates.openDate)
    : undefined;
  const closingDate = auction.dates.closingDate
    ? DateTime.fromISO(auction.dates.closingDate)
    : undefined;

  return (
    <Link href={`/auction/${auction.id}`}>
      <Card
        className={`group h-full overflow-hidden border-border/50 transition-all duration-200 hover:border-border hover:shadow-lg ${
          isPast ? "opacity-80 hover:opacity-100" : ""
        }`}
      >
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
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <CardContent className="p-5">
          <h3 className="line-clamp-2 text-lg font-medium leading-snug">
            {auction.title || "Untitled Auction"}
          </h3>

          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {openDate ? openDate.toFormat("MMM d, yyyy") : "Date TBA"}
                {closingDate && openDate && closingDate.toISODate() !== openDate.toISODate() && (
                  <span className="text-muted-foreground/70">
                    {" "}– {closingDate.toFormat("MMM d")}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{openDate ? openDate.toFormat("h:mm a") : "Time TBA"}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Lots</p>
              <p className="mt-0.5 font-medium">{auction.lotsCount || 0}</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              {isPast ? "View Results" : "View Auction"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Trust stats
const trustStats = [
  { icon: Shield, value: "100%", label: "Authenticated" },
  { icon: Award, value: "500+", label: "Auctions Held" },
  { icon: Users, value: "5,000+", label: "Active Bidders" },
  { icon: CheckCircle, value: "85%", label: "Sell-Through" },
];

export default async function AuctionsPage() {
  const allAuctions = (await getAllAuctions()) ?? [];
  const now = DateTime.now();

  // Separate auctions into categories
  const openAuctions = allAuctions.filter(
    (auction) =>
      auction.status === "OPENED" ||
      auction.status === "LIVE" ||
      auction.status === "CLOSING"
  );

  const upcomingAuctions = allAuctions
    .filter((auction) => {
      if (["CLOSED", "PROCESSING", "LIVE", "CLOSING", "OPENED"].includes(auction.status || ""))
        return false;
      if (!auction.dates.closingDate) return true;
      const closingDate = DateTime.fromISO(auction.dates.closingDate);
      return closingDate > now;
    })
    .sort((a, b) => {
      const dateA = a.dates.openDate
        ? DateTime.fromISO(a.dates.openDate)
        : DateTime.fromMillis(Number.MAX_SAFE_INTEGER);
      const dateB = b.dates.openDate
        ? DateTime.fromISO(b.dates.openDate)
        : DateTime.fromMillis(Number.MAX_SAFE_INTEGER);
      return dateA.toMillis() - dateB.toMillis();
    });

  const pastAuctions = allAuctions
    .filter((auction) => {
      if (auction.status === "CLOSED") return true;
      if (!auction.dates.closingDate) return false;
      const closingDate = DateTime.fromISO(auction.dates.closingDate);
      return closingDate <= now;
    })
    .sort((a, b) => {
      const dateA = a.dates.closingDate
        ? DateTime.fromISO(a.dates.closingDate)
        : DateTime.fromMillis(0);
      const dateB = b.dates.closingDate
        ? DateTime.fromISO(b.dates.closingDate)
        : DateTime.fromMillis(0);
      return dateB.toMillis() - dateA.toMillis();
    });

  // Group upcoming by month
  const upcomingByMonth = upcomingAuctions.reduce(
    (acc, auction) => {
      const dt = auction.dates.openDate ? DateTime.fromISO(auction.dates.openDate) : null;
      const monthKey = dt ? dt.toFormat("LLLL yyyy") : "Date TBA";
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(auction);
      return acc;
    },
    {} as Record<string, Auction[]>
  );

  // Group past by year
  const pastByYear = pastAuctions.reduce(
    (acc, auction) => {
      const dt = auction.dates.closingDate
        ? DateTime.fromISO(auction.dates.closingDate)
        : null;
      const yearKey = dt ? dt.toFormat("yyyy") : "Unknown";
      if (!acc[yearKey]) acc[yearKey] = [];
      acc[yearKey].push(auction);
      return acc;
    },
    {} as Record<string, Auction[]>
  );

  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero */}
      <PageHero
        title="Auction Calendar"
        subtitle="Browse our curated auctions featuring authenticated fine art, antiques, and collectibles from trusted consignors worldwide."
      />

      {/* Trust Stats */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {trustStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <Section>
        <Tabs defaultValue={openAuctions.length > 0 ? "open" : "upcoming"} className="w-full">
          <TabsList className="mb-8 grid w-full max-w-lg mx-auto grid-cols-3">
            <TabsTrigger value="open" className="gap-2">
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open</span> ({openAuctions.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Upcoming</span> ({upcomingAuctions.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Past</span> ({pastAuctions.length})
            </TabsTrigger>
          </TabsList>

          {/* Open Auctions */}
          <TabsContent value="open">
            {openAuctions.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center">
                  <Radio className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <h3 className="mt-4">No Open Auctions</h3>
                  <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                    There are no auctions currently open for bidding. Browse our upcoming sales
                    or check back soon.
                  </p>
                  <Button variant="outline" className="mt-6">
                    View Upcoming Auctions
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="mb-6 flex items-center gap-2 justify-center text-sm text-muted-foreground">
                  <div className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span>{openAuctions.length} auction{openAuctions.length !== 1 ? "s" : ""} open for bidding</span>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {openAuctions.map((auction) => (
                    <AuctionCard key={auction.id} auction={auction} />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* Upcoming Auctions */}
          <TabsContent value="upcoming">
            {upcomingAuctions.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center">
                  <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <h3 className="mt-4">No Upcoming Auctions</h3>
                  <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                    New sales are added regularly. Subscribe to our newsletter to be notified
                    when new auctions are announced.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-12">
                {Object.entries(upcomingByMonth).map(([month, auctions]) => (
                  <div key={month}>
                    <h2 className="mb-6 text-xl font-semibold">{month}</h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {auctions.map((auction) => (
                        <AuctionCard key={auction.id} auction={auction} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Past Auctions */}
          <TabsContent value="past">
            {pastAuctions.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center">
                  <History className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <h3 className="mt-4">No Past Auctions</h3>
                  <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                    Our archive will grow as auctions are completed. Check back after our
                    current sales close.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-12">
                {Object.entries(pastByYear).map(([year, auctions]) => (
                  <div key={year}>
                    <div className="mb-6 flex items-center justify-between">
                      <h2 className="text-xl font-semibold">{year}</h2>
                      <Link href="/results">
                        <Button variant="ghost" size="sm" className="gap-1">
                          View All Results
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {auctions.map((auction) => (
                        <AuctionCard key={auction.id} auction={auction} isPast />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Section>

      {/* Newsletter CTA */}
      <Section background="alt">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Stay Updated</h2>
          <p className="mt-4 text-muted-foreground">
            Subscribe to our newsletter to receive updates on upcoming auctions, featured lots,
            and exclusive previews.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full max-w-xs rounded-md border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="lg">Subscribe</Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </Section>

      {/* Consign CTA */}
      <Section background="highlight" size="lg">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Have Something to Sell?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our specialists provide complimentary valuations and guide you through the
            consignment process. Join hundreds of satisfied consignors.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/consign">
              <Button size="lg" className="gap-2">
                Request a Valuation
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/results">
              <Button variant="outline" size="lg">
                View Past Results
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
