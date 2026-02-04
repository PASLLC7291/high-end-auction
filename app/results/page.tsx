import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Calendar,
  Gavel,
  ArrowRight,
  DollarSign,
  Award,
  Users,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { DateTime } from "luxon";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";
import { getClientApiClient } from "@/lib/basta-client";

export const metadata = {
  title: "Auction Results | Auction House",
  description: "Browse past auction results and realized prices. See what collectors are paying for fine art, antiques, and collectibles.",
};

// Fetch past auctions
async function getPastAuctions() {
  if (!process.env.ACCOUNT_ID) {
    return [];
  }

  const client = getClientApiClient();

  try {
    const sales = await client.query({
      sales: {
        __args: {
          accountId: process.env.ACCOUNT_ID,
          first: 20,
          filter: {
            statuses: ["CLOSED", "PROCESSING"],
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
              edges: {
                node: {
                  id: true,
                  title: true,
                  images: { url: true },
                },
              },
            },
          },
        },
      },
    });

    return sales.sales.edges
      .filter(({ node }) => {
        const title = node.title?.toLowerCase() || "";
        const testKeywords = ["test", "e2e", "debug", "dropship", "headless"];
        return !testKeywords.some((kw) => title.includes(kw));
      })
      .map(({ node: sale }) => ({
        id: sale.id,
        title: sale.title ?? "Untitled Auction",
        image: sale.images?.[0]?.url || sale.items.edges?.[0]?.node?.images?.[0]?.url,
        closingDate: sale.dates.closingDate,
        lotsCount: sale.items.pageInfo.totalRecords,
      }));
  } catch (error) {
    console.error("Error fetching past auctions:", error);
    return [];
  }
}

// Highlight results (placeholder data for demonstration)
const highlightResults = [
  {
    title: "American Impressionist Landscape",
    artist: "William Merritt Chase (1849-1916)",
    category: "Fine Art",
    estimate: "$15,000 - $20,000",
    realized: "$28,750",
    premium: true,
    image: "/placeholder.jpg",
    date: "January 2024",
  },
  {
    title: "Tiffany Studios Lamp",
    artist: "Dragonfly Pattern, c. 1910",
    category: "Decorative Arts",
    estimate: "$8,000 - $12,000",
    realized: "$14,500",
    premium: false,
    image: "/placeholder.jpg",
    date: "January 2024",
  },
  {
    title: "Art Deco Diamond Bracelet",
    artist: "Cartier, c. 1925",
    category: "Jewelry",
    estimate: "$25,000 - $35,000",
    realized: "$42,000",
    premium: true,
    image: "/placeholder.jpg",
    date: "December 2023",
  },
  {
    title: "Signed Babe Ruth Baseball",
    artist: "PSA/DNA Authenticated",
    category: "Collectibles",
    estimate: "$10,000 - $15,000",
    realized: "$18,200",
    premium: false,
    image: "/placeholder.jpg",
    date: "December 2023",
  },
];

// Category stats (placeholder)
const categoryStats = [
  { category: "Fine Art", totalSold: 245, avgRealized: "$4,850" },
  { category: "Decorative Arts", totalSold: 312, avgRealized: "$2,100" },
  { category: "Jewelry & Watches", totalSold: 189, avgRealized: "$3,400" },
  { category: "Collectibles", totalSold: 156, avgRealized: "$1,800" },
];

// Summary stats
const summaryStats = [
  { icon: DollarSign, value: "$10M+", label: "Total Sales" },
  { icon: Gavel, value: "500+", label: "Auctions Completed" },
  { icon: Award, value: "85%", label: "Sell-Through Rate" },
  { icon: Users, value: "5,000+", label: "Active Bidders" },
];

export default async function ResultsPage() {
  const pastAuctions = await getPastAuctions();

  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero */}
      <PageHero
        title="Auction Results"
        subtitle="Browse our track record of successful sales. Transparent results build trust and help you understand market values."
      />

      {/* Summary Stats */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {summaryStats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="mt-3 text-2xl font-semibold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Highlight Results */}
      <Section>
        <SectionHeader
          title="Recent Highlights"
          subtitle="Notable results from our recent auctions."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {highlightResults.map((result, index) => (
            <Card key={index} className="border-border/50 overflow-hidden group">
              <div className="relative aspect-square bg-muted">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Gavel className="h-12 w-12 text-muted-foreground/30" />
                </div>
                {result.premium && (
                  <Badge className="absolute top-3 left-3 bg-primary">
                    Above Estimate
                  </Badge>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <p className="text-white text-2xl font-semibold">{result.realized}</p>
                  <p className="text-white/80 text-xs">Realized</p>
                </div>
              </div>
              <CardContent className="p-4">
                <Badge variant="outline" className="mb-2 text-xs">
                  {result.category}
                </Badge>
                <h4 className="font-medium line-clamp-1">{result.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-1">{result.artist}</p>
                <div className="mt-3 pt-3 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
                  <span>Est: {result.estimate}</span>
                  <span>{result.date}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Category Performance */}
      <Section background="alt">
        <SectionHeader
          title="Results by Category"
          subtitle="Performance across our main collecting categories."
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {categoryStats.map((cat, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="p-6">
                <h4 className="font-medium">{cat.category}</h4>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Lots Sold</span>
                    <span className="text-sm font-medium">{cat.totalSold}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg. Realized</span>
                    <span className="text-sm font-medium text-primary">{cat.avgRealized}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Past Auctions */}
      <Section>
        <SectionHeader
          title="Past Auctions"
          subtitle="Browse complete results from our previous sales."
        >
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter Results
          </Button>
        </SectionHeader>

        {pastAuctions.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Gavel className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4">No Past Auctions Available</h3>
              <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                Results from completed auctions will appear here. Check back after our next sale closes.
              </p>
              <Link href="/auctions">
                <Button variant="outline" className="mt-6">
                  View Current Auctions
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pastAuctions.map((auction) => {
              const closingDate = auction.closingDate
                ? DateTime.fromISO(auction.closingDate)
                : undefined;

              return (
                <Link key={auction.id} href={`/auction/${auction.id}`}>
                  <Card className="border-border/50 overflow-hidden h-full hover:border-border hover:shadow-lg transition-all">
                    <div className="relative aspect-[16/10] bg-muted">
                      {auction.image ? (
                        <img
                          src={auction.image}
                          alt={auction.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Gavel className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                      <Badge className="absolute top-3 right-3 bg-muted-foreground">
                        Closed
                      </Badge>
                    </div>
                    <CardContent className="p-5">
                      <h3 className="font-medium line-clamp-2">{auction.title}</h3>
                      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {closingDate ? closingDate.toFormat("MMM d, yyyy") : "Date TBD"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Gavel className="h-4 w-4" />
                          <span>{auction.lotsCount} lots</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <Button variant="ghost" size="sm" className="gap-1 p-0 h-auto">
                          View Results
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* Price Database CTA */}
      <Section background="alt">
        <div className="mx-auto max-w-2xl text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-primary/40" />
          <h2 className="mt-6">Research Market Values</h2>
          <p className="mt-4 text-muted-foreground">
            Our results archive helps collectors and sellers understand current market values.
            Use past results to inform your bidding strategy or estimate your collection's worth.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/consign">
              <Button className="gap-2">
                Get a Valuation
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline">
                Speak to a Specialist
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* Consign CTA */}
      <Section background="highlight" size="lg">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Ready to Sell?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our strong results attract serious collectors. Let us help you achieve the best possible price for your pieces.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/consign">
              <Button size="lg">Consign With Us</Button>
            </Link>
            <Link href="/auctions">
              <Button variant="outline" size="lg">
                View Current Auctions
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
