import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  UserPlus,
  CreditCard,
  Gavel,
  Trophy,
  Package,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  FileText,
  Camera,
  TrendingUp,
  Truck,
  Lock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";

export const metadata = {
  title: "How It Works | Auction House",
  description: "Learn how to bid, buy, and sell with confidence. Our transparent process makes participating in auctions simple and secure.",
};

// Buyer steps
const buyerSteps = [
  {
    step: 1,
    icon: Search,
    title: "Browse Auctions",
    description: "Explore our curated auctions featuring authenticated art, antiques, and collectibles. Each listing includes detailed descriptions, condition reports, and high-resolution photos.",
    tips: [
      "Use filters to find items by category, price range, or auction date",
      "Click on any lot to view full details and additional images",
      "Check the auction calendar for upcoming sales",
    ],
  },
  {
    step: 2,
    icon: UserPlus,
    title: "Create an Account",
    description: "Register for free to start bidding. You'll need to verify your email and add a payment method before placing bids.",
    tips: [
      "Registration takes just a few minutes",
      "Your information is securely encrypted",
      "One account works for all auctions",
    ],
  },
  {
    step: 3,
    icon: CreditCard,
    title: "Add Payment Method",
    description: "Add a credit card or bank account to enable bidding. Your payment method is only charged if you win.",
    tips: [
      "We accept all major credit cards",
      "Payment info is stored securely with Stripe",
      "You can update payment methods anytime",
    ],
  },
  {
    step: 4,
    icon: Gavel,
    title: "Place Your Bids",
    description: "Bid in real-time during live auctions or set maximum bids in advance. Our system will bid on your behalf up to your maximum.",
    tips: [
      "Set a maximum bid and let our system work for you",
      "Watch live auctions and bid in real-time",
      "Receive notifications when you're outbid",
    ],
  },
  {
    step: 5,
    icon: Trophy,
    title: "Win & Pay",
    description: "If you're the highest bidder when the auction closes, you win! You'll receive an invoice with the hammer price plus buyer's premium.",
    tips: [
      "Invoices are sent within 24 hours of auction close",
      "Payment is due within 7 days",
      "Multiple payment options available",
    ],
  },
  {
    step: 6,
    icon: Package,
    title: "Receive Your Item",
    description: "Choose shipping or local pickup. We handle professional packing and insured delivery for a seamless experience.",
    tips: [
      "White-glove shipping available for fragile items",
      "Full insurance included on all shipments",
      "International shipping available",
    ],
  },
];

// Seller steps
const sellerSteps = [
  {
    step: 1,
    icon: Camera,
    title: "Submit Your Items",
    description: "Send us photos and descriptions of items you'd like to sell. Our specialists will review and provide initial feedback.",
  },
  {
    step: 2,
    icon: FileText,
    title: "Get a Valuation",
    description: "Receive a complimentary valuation with estimated auction results. We'll discuss timing and strategy for your consignment.",
  },
  {
    step: 3,
    icon: Shield,
    title: "Consign with Confidence",
    description: "Sign a simple consignment agreement. We handle photography, cataloging, marketing, and the entire auction process.",
  },
  {
    step: 4,
    icon: TrendingUp,
    title: "Watch It Sell",
    description: "Track your items in the auction. Our marketing reaches thousands of qualified collectors worldwide.",
  },
  {
    step: 5,
    icon: CreditCard,
    title: "Get Paid",
    description: "Receive payment within 30 days of auction close. We handle all buyer communications and payment collection.",
  },
];

// Bidding types explained
const biddingTypes = [
  {
    title: "Maximum Bid",
    description: "Set your highest price and our system bids for you incrementally, only as much as needed to stay ahead, up to your maximum.",
    icon: TrendingUp,
  },
  {
    title: "Live Bidding",
    description: "Bid in real-time as the auction happens. Watch the action and place bids manually when you're ready.",
    icon: Clock,
  },
  {
    title: "Absentee Bid",
    description: "Can't attend the live auction? Leave an absentee bid and we'll execute it on your behalf.",
    icon: FileText,
  },
];

// Fees explained
const feesExplained = [
  {
    title: "Buyer's Premium",
    percentage: "25%",
    description: "Added to the hammer price on all winning bids. This covers auction operations, insurance, and services.",
  },
  {
    title: "Seller's Commission",
    percentage: "Varies",
    description: "Negotiated based on consignment value. Contact us for a personalized quote.",
  },
  {
    title: "Shipping",
    percentage: "At cost",
    description: "Actual shipping and handling costs. Quotes provided before you commit.",
  },
];

// Common questions preview
const faqPreview = [
  {
    question: "What if I can't pay right away?",
    answer: "Contact us immediately. We can sometimes arrange payment plans for larger purchases, but communication is key.",
  },
  {
    question: "Can I inspect items before bidding?",
    answer: "Yes! We offer preview appointments before most auctions. Contact us to schedule a time to view lots in person.",
  },
  {
    question: "What happens if an item is damaged in shipping?",
    answer: "All shipments are fully insured. In the rare event of damage, file a claim and we'll work with you to resolve it.",
  },
  {
    question: "How do I know items are authentic?",
    answer: "Every item is vetted by our specialists. We provide detailed condition reports and stand behind our descriptions.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero */}
      <PageHero
        title="How It Works"
        subtitle="Whether you're buying or selling, our transparent process makes participating in auctions simple and secure. Here's everything you need to know."
      />

      {/* Quick Nav */}
      <div className="border-b border-border bg-card sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2 py-3 overflow-x-auto">
            <a href="#buying" className="px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors whitespace-nowrap">
              Buying
            </a>
            <a href="#selling" className="px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors whitespace-nowrap">
              Selling
            </a>
            <a href="#bidding" className="px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors whitespace-nowrap">
              Bidding Types
            </a>
            <a href="#fees" className="px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors whitespace-nowrap">
              Fees
            </a>
            <a href="#faq" className="px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors whitespace-nowrap">
              FAQ
            </a>
          </div>
        </div>
      </div>

      {/* For Buyers */}
      <Section id="buying">
        <SectionHeader
          title="For Buyers"
          subtitle="From browsing to receiving your purchase, here's how the buying process works."
        />

        <div className="space-y-12">
          {buyerSteps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line */}
              {index < buyerSteps.length - 1 && (
                <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-border hidden md:block" />
              )}

              <div className="flex gap-6">
                {/* Step number */}
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    {step.step}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-8">
                  <div className="flex items-center gap-3">
                    <step.icon className="h-5 w-5 text-primary" />
                    <h3 className="text-xl">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-muted-foreground leading-relaxed max-w-2xl">
                    {step.description}
                  </p>
                  {step.tips && (
                    <ul className="mt-4 space-y-2">
                      {step.tips.map((tip, tipIndex) => (
                        <li key={tipIndex} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/auctions">
            <Button size="lg" className="gap-2">
              Browse Auctions
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* For Sellers */}
      <Section id="selling" background="alt">
        <SectionHeader
          title="For Sellers"
          subtitle="Consigning with us is simple. We handle everything from photography to payment collection."
        />

        <div className="grid gap-6 md:grid-cols-5">
          {sellerSteps.map((step, index) => (
            <Card key={index} className="border-border/50 text-center relative">
              {/* Arrow connector */}
              {index < sellerSteps.length - 1 && (
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden md:block z-10">
                  <ArrowRight className="h-6 w-6 text-border" />
                </div>
              )}
              <CardContent className="p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  {step.step}
                </div>
                <div className="mt-3 flex justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <h4 className="mt-2 font-medium">{step.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/consign">
            <Button size="lg" className="gap-2">
              Start Selling
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* Bidding Types */}
      <Section id="bidding">
        <SectionHeader
          title="Bidding Options"
          subtitle="Choose the bidding style that works best for you."
        />

        <div className="grid gap-6 md:grid-cols-3">
          {biddingTypes.map((type, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <type.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4">{type.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {type.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bid increment info */}
        <Card className="mt-8 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Understanding Bid Increments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Bids increase by set amounts based on the current price. This ensures fair, orderly bidding.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { range: "$0 - $99", increment: "$5" },
                { range: "$100 - $499", increment: "$10" },
                { range: "$500 - $999", increment: "$25" },
                { range: "$1,000 - $4,999", increment: "$50" },
                { range: "$5,000 - $9,999", increment: "$100" },
                { range: "$10,000 - $24,999", increment: "$250" },
                { range: "$25,000 - $49,999", increment: "$500" },
                { range: "$50,000+", increment: "$1,000" },
              ].map((tier, index) => (
                <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">{tier.range}</span>
                  <span className="text-sm font-medium text-primary">{tier.increment}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Fees */}
      <Section id="fees" background="alt">
        <SectionHeader
          title="Transparent Pricing"
          subtitle="No hidden fees. Here's exactly what to expect."
        />

        <div className="grid gap-6 md:grid-cols-3">
          {feesExplained.map((fee, index) => (
            <Card key={index} className="border-border/50 text-center">
              <CardContent className="p-6">
                <p className="text-3xl font-semibold text-primary">{fee.percentage}</p>
                <h3 className="mt-2">{fee.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {fee.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 border-border/50 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Example: Winning a $1,000 Item</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hammer Price: $1,000 + Buyer's Premium (20%): $200 = <strong className="text-foreground">Total: $1,200</strong> (plus applicable shipping)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link href="/buyers-premium">
            <Button variant="outline">
              View Full Fee Schedule
            </Button>
          </Link>
        </div>
      </Section>

      {/* FAQ Preview */}
      <Section id="faq">
        <SectionHeader
          title="Common Questions"
          subtitle="Quick answers to frequently asked questions."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {faqPreview.map((item, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">{item.question}</h4>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/faq">
            <Button variant="outline" className="gap-2">
              View All FAQs
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* CTA */}
      <Section background="highlight" size="lg">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Ready to Get Started?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join thousands of collectors who trust us for exceptional pieces and outstanding service.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg">Create an Account</Button>
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
