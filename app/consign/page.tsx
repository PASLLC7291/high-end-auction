import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { ValuationForm } from "@/components/forms/valuation-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield,
  TrendingUp,
  Users,
  Camera,
  FileText,
  CheckCircle,
  ArrowRight,
  Phone,
  Mail,
  Clock,
  DollarSign,
  Award,
  Truck,
  Globe,
  Handshake,
  Eye,
  Lock,
  Palette,
  Gem,
  Watch,
  Frame,
  Archive,
} from "lucide-react";
import Link from "next/link";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";
import { TestimonialCard } from "@/components/trust/testimonial-card";

export const metadata = {
  title: "Sell With Us | Auction House",
  description: "Consign your fine art, antiques, and collectibles with confidence. Expert valuations, global reach, and transparent commissions.",
};

// Why consign benefits
const benefits = [
  {
    icon: Globe,
    title: "Global Reach",
    description: "Your items reach thousands of qualified collectors worldwide through our marketing and bidder network.",
  },
  {
    icon: Eye,
    title: "Expert Curation",
    description: "Our specialists research, photograph, and catalog your items to present them in the best possible light.",
  },
  {
    icon: TrendingUp,
    title: "Strong Results",
    description: "85% sell-through rate with competitive realized prices. We work to maximize value for every consignment.",
  },
  {
    icon: Shield,
    title: "Full Insurance",
    description: "Your items are fully insured from the moment they arrive until payment is complete.",
  },
  {
    icon: Handshake,
    title: "Transparent Terms",
    description: "Clear commission rates with no hidden fees. You know exactly what to expect before consigning.",
  },
  {
    icon: Lock,
    title: "Secure Process",
    description: "Professional handling, secure storage, and vetted buyers give you peace of mind throughout.",
  },
];

// What we accept
const categories = [
  {
    icon: Frame,
    title: "Fine Art",
    items: ["Paintings", "Drawings", "Prints", "Sculpture", "Photography"],
  },
  {
    icon: Archive,
    title: "Antiques",
    items: ["Furniture", "Silver", "Ceramics", "Glass", "Decorative Objects"],
  },
  {
    icon: Gem,
    title: "Jewelry",
    items: ["Fine Jewelry", "Estate Pieces", "Signed Pieces", "Colored Stones"],
  },
  {
    icon: Watch,
    title: "Watches",
    items: ["Luxury Brands", "Vintage Timepieces", "Complications", "Limited Editions"],
  },
  {
    icon: Palette,
    title: "Collectibles",
    items: ["Sports Memorabilia", "Autographs", "Coins", "Stamps"],
  },
  {
    icon: FileText,
    title: "Books & Documents",
    items: ["Rare Books", "Manuscripts", "Maps", "Historical Documents"],
  },
];

// Consignment process
const processSteps = [
  {
    step: 1,
    title: "Submit Your Items",
    description: "Share photos and descriptions via our form, email, or schedule an in-person appointment.",
    icon: Camera,
  },
  {
    step: 2,
    title: "Receive a Valuation",
    description: "Our specialists review your submission and provide a complimentary auction estimate.",
    icon: FileText,
  },
  {
    step: 3,
    title: "Agree on Terms",
    description: "We discuss timing, reserves, and commission. Sign a simple consignment agreement.",
    icon: Handshake,
  },
  {
    step: 4,
    title: "We Handle the Rest",
    description: "Professional photography, cataloging, marketing, and auction execution—all managed by us.",
    icon: CheckCircle,
  },
  {
    step: 5,
    title: "Get Paid",
    description: "Receive payment within 30 days of auction close. We handle all buyer communications.",
    icon: DollarSign,
  },
];

// Services
const services = [
  {
    id: "valuations",
    title: "Complimentary Valuations",
    description: "Get expert opinions on your items at no cost. Our specialists provide auction estimates based on current market conditions and comparable sales.",
    features: [
      "Written appraisals available for insurance or estate purposes",
      "In-person appointments at our gallery",
      "Virtual consultations via video call",
      "On-site visits for large collections",
    ],
  },
  {
    id: "private-sales",
    title: "Private Sales",
    description: "For select items, we offer discreet private sale services connecting you directly with qualified buyers outside the auction format.",
    features: [
      "Confidential transactions",
      "Targeted outreach to collectors",
      "Flexible timing",
      "Negotiated pricing",
    ],
  },
  {
    id: "collection",
    title: "Collection Management",
    description: "Comprehensive services for collectors and estates including inventory, insurance valuations, and strategic sales planning.",
    features: [
      "Full collection cataloging",
      "Insurance documentation",
      "Deaccession strategy",
      "Multi-year sales planning",
    ],
  },
];

// Testimonials from consignors
const consignorTestimonials = [
  {
    quote: "The expertise and transparency made selling my late father's collection much easier than expected. They exceeded our estimates.",
    author: "Patricia Morrison",
    title: "Estate Executor",
    location: "Greenwich, CT",
  },
  {
    quote: "I've consigned with several auction houses over the years. The personalized service and strong results here keep me coming back.",
    author: "Richard Chen",
    title: "Private Collector",
    location: "Los Angeles, CA",
  },
];

// Stats
const stats = [
  { value: "85%", label: "Sell-Through Rate" },
  { value: "$10M+", label: "Total Sales" },
  { value: "30 Days", label: "Payment Timeline" },
  { value: "5,000+", label: "Active Bidders" },
];

export default function ConsignPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero */}
      <PageHero
        title="Sell With Confidence"
        subtitle="Partner with specialists who understand your collection's value. Expert curation, global reach, and transparent terms make consigning with us simple and rewarding."
      >
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a href="#valuation-form">
            <Button size="lg" className="gap-2">
              Request a Valuation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
          <Link href="/contact">
            <Button variant="outline" size="lg">
              Speak to a Specialist
            </Button>
          </Link>
        </div>
      </PageHero>

      {/* Stats Bar */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-2xl font-semibold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why Consign */}
      <Section>
        <SectionHeader
          title="Why Consign With Us"
          subtitle="We're committed to achieving the best results for your collection."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4">{benefit.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* What We Accept */}
      <Section background="alt">
        <SectionHeader
          title="What We Accept"
          subtitle="We specialize in quality pieces across these collecting categories."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <category.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg">{category.title}</h3>
                </div>
                <ul className="mt-4 space-y-1">
                  {category.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-center text-muted-foreground">
          Not sure if your item is right for auction?{" "}
          <Link href="/contact" className="text-primary hover:underline">
            Contact us
          </Link>{" "}
          for a complimentary evaluation.
        </p>
      </Section>

      {/* The Process */}
      <Section>
        <SectionHeader
          title="How It Works"
          subtitle="From submission to payment, we make the process simple."
          align="center"
        />
        <div className="relative mx-auto max-w-4xl">
          {/* Timeline connector */}
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border md:left-1/2 md:-translate-x-1/2" />

          <div className="space-y-8">
            {processSteps.map((step, index) => (
              <div
                key={index}
                className={`relative flex gap-6 md:gap-0 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Step circle */}
                <div className="absolute left-0 flex h-12 w-12 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground font-semibold md:left-1/2 md:-translate-x-1/2 z-10">
                  {step.step}
                </div>

                {/* Content */}
                <div className={`ml-16 md:ml-0 md:w-1/2 ${index % 2 === 0 ? "md:pr-16 md:text-right" : "md:pl-16"}`}>
                  <Card className="border-border/50">
                    <CardContent className="p-5">
                      <div className={`flex items-center gap-2 ${index % 2 === 0 ? "md:justify-end" : ""}`}>
                        <step.icon className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">{step.title}</h4>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Services */}
      <Section background="alt">
        <SectionHeader
          title="Our Services"
          subtitle="Beyond traditional auctions, we offer specialized services for collectors and estates."
        />
        <div className="space-y-8">
          {services.map((service) => (
            <Card key={service.id} id={service.id} className="border-border/50 scroll-mt-24">
              <CardContent className="p-6 md:p-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-xl">{service.title}</h3>
                    <p className="mt-3 text-muted-foreground leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                  <div>
                    <ul className="space-y-2">
                      {service.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Testimonials */}
      <Section>
        <SectionHeader
          title="From Our Consignors"
          subtitle="Hear from collectors and estates who've trusted us with their pieces."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {consignorTestimonials.map((testimonial, index) => (
            <TestimonialCard key={index} testimonial={testimonial} />
          ))}
        </div>
      </Section>

      {/* Valuation Form */}
      <Section id="valuation-form" background="alt">
        <div className="mx-auto max-w-2xl">
          <SectionHeader
            title="Request a Valuation"
            subtitle="Tell us about your items and our specialists will provide a complimentary auction estimate."
            align="center"
          />

          <Card className="border-border/50">
            <CardContent className="p-6 md:p-8">
              <ValuationForm />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Contact Options */}
      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2>Prefer to Talk?</h2>
          <p className="mt-4 text-muted-foreground">
            Our specialists are happy to discuss your collection by phone or in person.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            <a
              href="tel:+12345678900"
              className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span>+1 (234) 567-8900</span>
            </a>
            <a
              href="mailto:consign@auctionhouse.com"
              className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-5 w-5" />
              <span>consign@auctionhouse.com</span>
            </a>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Monday - Friday, 9am - 6pm EST</span>
          </div>
        </div>
      </Section>

      {/* Final CTA */}
      <Section background="highlight" size="lg">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Ready to Get Started?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join hundreds of satisfied consignors who've trusted us with their collections.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="#valuation-form">
              <Button size="lg">Request a Valuation</Button>
            </a>
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
