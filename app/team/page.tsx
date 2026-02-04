import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  Phone,
  Linkedin,
  ArrowRight,
  Award,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";
import { TeamMemberCard, TeamGrid } from "@/components/trust/team-member-card";

export const metadata = {
  title: "Our Team | Auction House",
  description: "Meet our team of experienced specialists with decades of expertise in fine art, antiques, and collectibles.",
};

// Leadership team
const leadership = [
  {
    name: "Jonathan Pierce",
    title: "Founder & CEO",
    bio: "With over 25 years in the auction industry, Jonathan founded Auction House to bring a higher standard of trust to online sales. Previously, he held senior positions at Christie's and Heritage Auctions.",
    credentials: ["25+ Years Experience", "Former Christie's Director", "ISA Member"],
    specialties: ["American Art", "Modern & Contemporary"],
    image: "/placeholder-user.jpg",
    email: "jonathan@auctionhouse.com",
    linkedin: "#",
  },
  {
    name: "Catherine Wells",
    title: "Chief Operations Officer",
    bio: "Catherine oversees all auction operations, ensuring every sale runs smoothly from consignment to delivery. Her background in logistics and client services shapes our commitment to excellence.",
    credentials: ["20+ Years Experience", "Operations Excellence", "MBA"],
    specialties: ["Operations", "Client Services"],
    image: "/placeholder-user.jpg",
    email: "catherine@auctionhouse.com",
    linkedin: "#",
  },
];

// Department specialists
const specialists = {
  fineArt: {
    title: "Fine Art",
    description: "Our fine art specialists bring expertise across periods and movements.",
    members: [
      {
        name: "Alexandra Reed",
        title: "Head of Fine Art",
        credentials: ["20+ Years Experience", "Former Christie's", "AAA Member"],
        specialties: ["American Art", "Impressionism", "Modern Masters"],
        image: "/placeholder-user.jpg",
        email: "alexandra@auctionhouse.com",
      },
      {
        name: "David Chen",
        title: "Senior Specialist",
        credentials: ["15+ Years Experience", "PhD Art History", "Published Author"],
        specialties: ["Contemporary Art", "Asian Art", "Photography"],
        image: "/placeholder-user.jpg",
        email: "david@auctionhouse.com",
      },
    ],
  },
  decorativeArts: {
    title: "Decorative Arts & Antiques",
    description: "Expert knowledge in furniture, silver, ceramics, and decorative objects.",
    members: [
      {
        name: "Michael Torres",
        title: "Head of Decorative Arts",
        credentials: ["18+ Years Experience", "Certified Appraiser", "ASA Member"],
        specialties: ["American Furniture", "Silver", "Ceramics"],
        image: "/placeholder-user.jpg",
        email: "michael@auctionhouse.com",
      },
      {
        name: "Rebecca Stone",
        title: "Specialist",
        credentials: ["12+ Years Experience", "Winterthur Fellow", "ISA Member"],
        specialties: ["European Furniture", "Decorative Objects", "Glass"],
        image: "/placeholder-user.jpg",
        email: "rebecca@auctionhouse.com",
      },
    ],
  },
  jewelry: {
    title: "Jewelry & Watches",
    description: "Certified gemologists and horological experts.",
    members: [
      {
        name: "Sarah Kim",
        title: "Head of Jewelry",
        credentials: ["GIA Graduate Gemologist", "15+ Years Experience"],
        specialties: ["Fine Jewelry", "Estate Pieces", "Colored Stones"],
        image: "/placeholder-user.jpg",
        email: "sarah@auctionhouse.com",
      },
      {
        name: "Thomas Wright",
        title: "Watch Specialist",
        credentials: ["AWCI Certified", "10+ Years Experience"],
        specialties: ["Luxury Watches", "Vintage Timepieces", "Complications"],
        image: "/placeholder-user.jpg",
        email: "thomas@auctionhouse.com",
      },
    ],
  },
  collectibles: {
    title: "Collectibles & Memorabilia",
    description: "Specialists in sports, entertainment, and historical memorabilia.",
    members: [
      {
        name: "James Morrison",
        title: "Head of Collectibles",
        credentials: ["20+ Years Experience", "PSA Certified", "Authentication Expert"],
        specialties: ["Sports Memorabilia", "Historical Documents", "Autographs"],
        image: "/placeholder-user.jpg",
        email: "james@auctionhouse.com",
      },
    ],
  },
};

// Client services team
const clientServices = [
  {
    name: "Emily Watson",
    title: "Director of Client Relations",
    credentials: ["15+ Years Experience", "Collector Services"],
    specialties: ["Private Sales", "Collection Management", "New Clients"],
    image: "/placeholder-user.jpg",
    email: "emily@auctionhouse.com",
  },
  {
    name: "Robert Hayes",
    title: "Shipping & Logistics Manager",
    credentials: ["Fine Art Handling Certified", "10+ Years Experience"],
    specialties: ["White-Glove Delivery", "International Shipping", "Insurance"],
    image: "/placeholder-user.jpg",
    email: "robert@auctionhouse.com",
  },
  {
    name: "Lisa Park",
    title: "Client Services Associate",
    credentials: ["Bilingual (EN/KR)", "Art History Background"],
    specialties: ["Bidder Support", "Payment Processing", "Inquiries"],
    image: "/placeholder-user.jpg",
    email: "lisa@auctionhouse.com",
  },
];

// Credentials summary
const credentialsSummary = [
  {
    icon: GraduationCap,
    stat: "8",
    label: "Advanced Degrees",
  },
  {
    icon: Award,
    stat: "12",
    label: "Industry Certifications",
  },
  {
    icon: Briefcase,
    stat: "150+",
    label: "Years Combined Experience",
  },
];

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero */}
      <PageHero
        title="Meet Our Specialists"
        subtitle="Our team brings decades of experience from leading auction houses, museums, and galleries. We're passionate about connecting collectors with exceptional pieces."
      />

      {/* Credentials Summary */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap items-center justify-center gap-12">
            {credentialsSummary.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{item.stat}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leadership */}
      <Section>
        <SectionHeader
          title="Leadership"
          subtitle="Guiding our vision for trust and excellence."
        />
        <div className="grid gap-8 md:grid-cols-2">
          {leadership.map((leader, index) => (
            <Card key={index} className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  {/* Photo */}
                  <div className="sm:w-1/3 bg-muted aspect-square sm:aspect-auto flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="h-24 w-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl font-semibold text-primary">
                          {leader.name.split(" ").map(n => n[0]).join("")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="sm:w-2/3 p-6">
                    <h3 className="text-xl">{leader.name}</h3>
                    <p className="text-sm text-primary font-medium">{leader.title}</p>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      {leader.bio}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {leader.credentials.map((cred, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                        >
                          {cred}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <a
                        href={`mailto:${leader.email}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                      <a
                        href={leader.linkedin}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Specialists by Department */}
      {Object.values(specialists).map((dept, deptIndex) => (
        <Section key={deptIndex} background={deptIndex % 2 === 0 ? "alt" : "default"}>
          <SectionHeader
            title={dept.title}
            subtitle={dept.description}
          />
          <TeamGrid>
            {dept.members.map((member, index) => (
              <TeamMemberCard
                key={index}
                member={member}
                showContact={true}
              />
            ))}
          </TeamGrid>
        </Section>
      ))}

      {/* Client Services */}
      <Section background="alt">
        <SectionHeader
          title="Client Services"
          subtitle="Dedicated support from inquiry to delivery."
        />
        <TeamGrid>
          {clientServices.map((member, index) => (
            <TeamMemberCard
              key={index}
              member={member}
              showContact={true}
            />
          ))}
        </TeamGrid>
      </Section>

      {/* Join Our Team CTA */}
      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2>Join Our Team</h2>
          <p className="mt-4 text-muted-foreground">
            We're always looking for passionate specialists and professionals to join
            our growing team. If you share our commitment to trust and excellence,
            we'd love to hear from you.
          </p>
          <Link href="/careers">
            <Button className="mt-8 gap-2">
              View Open Positions
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* Contact CTA */}
      <Section background="highlight" size="lg">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Questions for Our Team?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our specialists are available to discuss your collection, answer questions
            about upcoming auctions, or provide complimentary valuations.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/contact">
              <Button size="lg">Contact Us</Button>
            </Link>
            <Link href="/consign">
              <Button variant="outline" size="lg">
                Request a Valuation
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
