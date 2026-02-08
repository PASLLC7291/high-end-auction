import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Award,
  Eye,
  Heart,
  Scale,
  CheckCircle,
  Building2,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";

export const metadata = {
  title: "About Us | Auction House",
  description: "Learn about our mission, values, and commitment to trust and authenticity in the auction industry.",
};

// Company values
const values = [
  {
    icon: Shield,
    title: "Integrity First",
    description:
      "We operate with complete transparency. Every item description, condition report, and provenance detail is accurate and honest.",
  },
  {
    icon: Eye,
    title: "Expert Curation",
    description:
      "Our specialists carefully vet every item. We reject pieces that don't meet our standards for quality and authenticity.",
  },
  {
    icon: Heart,
    title: "Client-Centered",
    description:
      "Whether you're buying or selling, your experience matters. We provide personalized guidance every step of the way.",
  },
  {
    icon: Scale,
    title: "Fair Dealing",
    description:
      "Transparent fees, accurate estimates, and ethical practices. We believe trust is earned through consistent fair dealing.",
  },
];

// Company timeline
const timeline = [
  {
    year: "2020",
    title: "Founded",
    description: "Established with a vision to bring trust and transparency to online auctions.",
  },
  {
    year: "2021",
    title: "First Major Sale",
    description: "Achieved our first million-dollar auction, a private collection of American art.",
  },
  {
    year: "2022",
    title: "Expanded Specialties",
    description: "Added dedicated departments for decorative arts, jewelry, and collectibles.",
  },
  {
    year: "2023",
    title: "Industry Recognition",
    description: "Recognized for excellence in online auction practices and client service.",
  },
  {
    year: "2024",
    title: "Growing Community",
    description: "Surpassed 5,000 registered bidders and 500 successful auctions.",
  },
];

// Affiliations and credentials
const affiliations = [
  {
    icon: Building2,
    name: "Appraisers Association",
    description: "Member in good standing",
  },
  {
    icon: GraduationCap,
    name: "Certified Appraisers",
    description: "ISA and ASA certified specialists",
  },
  {
    icon: Shield,
    name: "Insured & Bonded",
    description: "Comprehensive coverage",
  },
  {
    icon: Award,
    name: "Industry Standards",
    description: "Adherence to USPAP guidelines",
  },
];

// What sets us apart
const differentiators = [
  {
    title: "Rigorous Authentication",
    description:
      "Every item undergoes thorough research and authentication by our specialists before listing.",
  },
  {
    title: "Detailed Condition Reports",
    description:
      "Comprehensive written reports with high-resolution photography document every aspect of condition.",
  },
  {
    title: "Provenance Research",
    description:
      "We trace ownership history and provide documentation to support authenticity claims.",
  },
  {
    title: "Transparent Pricing",
    description:
      "Clear buyer's premium and seller's commission with no hidden fees or surprise charges.",
  },
  {
    title: "Secure Transactions",
    description:
      "Industry-standard payment processing and escrow services protect both buyers and sellers.",
  },
  {
    title: "White-Glove Service",
    description:
      "Professional packing, insured shipping, and dedicated support from bid to delivery.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero */}
      <PageHero
        title="Building Trust in Every Transaction"
        subtitle="We're dedicated to creating a trustworthy marketplace where collectors and consignors can transact with confidence."
      />

      {/* Our Story */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeader
              title="Our Story"
              subtitle="Founded by collectors, for collectors."
            />
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Auction House was founded in 2020 with a mission to bring a higher standard of
                trust and service to the online auction market.
              </p>
              <p>
                The foundation of any successful auction business is trust. Buyers need confidence
                that items are accurately described and authenticated. Sellers need assurance
                that their pieces will be marketed effectively and sold fairly.
              </p>
              <p>
                We built Auction House on these principles: rigorous authentication, transparent
                processes, and exceptional client service. Every decision we make is guided by
                one question: "Does this build trust with our clients?"
              </p>
              <p>
                Today, we're proud to serve a growing community of collectors, dealers, and
                institutions who trust us with their most valued pieces.
              </p>
            </div>
          </div>
          <div className="relative">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                  <div className="text-center p-8">
                    <Award className="h-16 w-16 mx-auto text-primary/40" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      [Company image placeholder]
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Stats overlay */}
            <div className="absolute -bottom-6 left-6 right-6">
              <Card className="border-border/50 shadow-lg">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-semibold text-primary">500+</p>
                      <p className="text-xs text-muted-foreground">Auctions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-primary">$10M+</p>
                      <p className="text-xs text-muted-foreground">Total Sales</p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-primary">5,000+</p>
                      <p className="text-xs text-muted-foreground">Collectors</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Section>

      {/* Our Values */}
      <Section background="alt">
        <SectionHeader
          title="Our Values"
          subtitle="The principles that guide everything we do."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {values.map((value, index) => (
            <Card key={index} className="border-border/50 text-center">
              <CardContent className="p-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <value.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mt-4">{value.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {value.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Our Journey */}
      <Section>
        <SectionHeader
          title="Our Journey"
          subtitle="Key milestones in our growth."
          align="center"
        />
        <div className="relative mx-auto max-w-3xl">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border md:left-1/2 md:-translate-x-1/2" />

          <div className="space-y-8">
            {timeline.map((item, index) => (
              <div
                key={index}
                className={`relative flex gap-6 md:gap-0 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Dot */}
                <div className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground text-sm font-medium md:left-1/2 md:-translate-x-1/2">
                  {item.year.slice(2)}
                </div>

                {/* Content */}
                <div className={`ml-14 md:ml-0 md:w-1/2 ${index % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
                  <Card className="border-border/50">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-primary">{item.year}</p>
                      <h4 className="mt-1 font-medium">{item.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* What Sets Us Apart */}
      <Section background="alt">
        <SectionHeader
          title="What Sets Us Apart"
          subtitle="Our commitment to trust shapes every aspect of our service."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {differentiators.map((item, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div>
                <h4 className="font-medium">{item.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Credentials & Affiliations */}
      <Section>
        <SectionHeader
          title="Credentials & Affiliations"
          subtitle="Committed to industry standards and professional excellence."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {affiliations.map((item, index) => (
            <Card key={index} className="border-border/50 text-center">
              <CardContent className="p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <item.icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="mt-4 font-medium">{item.name}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section background="highlight" size="lg">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Ready to Work With Us?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Whether you're looking to buy or sell, we're here to help.
            Contact us for a consultation or browse our upcoming auctions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/auctions">
              <Button size="lg">Browse Auctions</Button>
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
