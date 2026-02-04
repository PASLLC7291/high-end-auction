import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { ContactForm } from "@/components/forms/contact-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  MessageSquare,
  Gavel,
  CreditCard,
  HelpCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";

export const metadata = {
  title: "Contact Us | Auction House",
  description: "Get in touch with our team. We're here to help with bidding, consignments, valuations, and any questions you may have.",
};

// Contact methods
const contactMethods = [
  {
    icon: Phone,
    title: "Phone",
    value: "+1 (234) 567-8900",
    href: "tel:+12345678900",
    description: "Speak directly with our team",
  },
  {
    icon: Mail,
    title: "Email",
    value: "info@auctionhouse.com",
    href: "mailto:info@auctionhouse.com",
    description: "We respond within 24 hours",
  },
  {
    icon: MapPin,
    title: "Address",
    value: "123 Auction Street\nNew York, NY 10001",
    href: "https://maps.google.com",
    description: "Visit our gallery",
  },
];

// Office hours
const officeHours = [
  { day: "Monday - Friday", hours: "9:00 AM - 6:00 PM EST" },
  { day: "Saturday", hours: "10:00 AM - 4:00 PM EST" },
  { day: "Sunday", hours: "Closed" },
];

// Department contacts
const departments = [
  {
    icon: MessageSquare,
    title: "General Inquiries",
    email: "info@auctionhouse.com",
    phone: "+1 (234) 567-8900",
    description: "Questions about our services, auctions, or company.",
  },
  {
    icon: Gavel,
    title: "Consignments",
    email: "consign@auctionhouse.com",
    phone: "+1 (234) 567-8901",
    description: "Interested in selling? Speak with our consignment team.",
  },
  {
    icon: CreditCard,
    title: "Bidder Support",
    email: "bidding@auctionhouse.com",
    phone: "+1 (234) 567-8902",
    description: "Help with registration, bidding, payments, or shipping.",
  },
  {
    icon: Users,
    title: "Specialist Appointments",
    email: "specialists@auctionhouse.com",
    phone: "+1 (234) 567-8903",
    description: "Schedule a consultation with our category experts.",
  },
];

// Inquiry types for form
const inquiryTypes = [
  { value: "general", label: "General Inquiry" },
  { value: "consignment", label: "Consignment / Selling" },
  { value: "bidding", label: "Bidding Help" },
  { value: "payment", label: "Payment / Invoice" },
  { value: "shipping", label: "Shipping / Delivery" },
  { value: "valuation", label: "Valuation Request" },
  { value: "press", label: "Press / Media" },
  { value: "careers", label: "Careers" },
  { value: "other", label: "Other" },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero */}
      <PageHero
        title="Get in Touch"
        subtitle="We're here to help. Whether you have questions about bidding, want to discuss a consignment, or need support, our team is ready to assist."
      />

      {/* Main Content */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Contact Form */}
          <div>
            <SectionHeader
              title="Send Us a Message"
              subtitle="Fill out the form below and we'll get back to you promptly."
            />

            <Card className="border-border/50">
              <CardContent className="p-6">
                <ContactForm inquiryTypes={inquiryTypes} />
              </CardContent>
            </Card>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            {/* Direct Contact */}
            <div>
              <SectionHeader
                title="Contact Information"
                subtitle="Reach us directly by phone, email, or visit our gallery."
              />

              <div className="space-y-4">
                {contactMethods.map((method, index) => (
                  <Card key={index} className="border-border/50">
                    <CardContent className="p-4">
                      <a
                        href={method.href}
                        className="flex items-start gap-4 group"
                        target={method.title === "Address" ? "_blank" : undefined}
                        rel={method.title === "Address" ? "noopener noreferrer" : undefined}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                          <method.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">
                            {method.title}
                          </p>
                          <p className="text-sm text-foreground whitespace-pre-line">
                            {method.value}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {method.description}
                          </p>
                        </div>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Office Hours */}
            <div>
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <Clock className="h-5 w-5 text-primary" />
                Office Hours
              </h3>
              <Card className="mt-4 border-border/50">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {officeHours.map((schedule, index) => (
                      <div
                        key={index}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{schedule.day}</span>
                        <span className="font-medium">{schedule.hours}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Map Placeholder */}
            <div>
              <Card className="border-border/50 overflow-hidden">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      [Map placeholder]
                    </p>
                    <a
                      href="https://maps.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2"
                    >
                      <Button variant="outline" size="sm">
                        Open in Google Maps
                      </Button>
                    </a>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Section>

      {/* Department Contacts */}
      <Section background="alt">
        <SectionHeader
          title="Department Contacts"
          subtitle="Reach the right team directly for faster assistance."
          align="center"
        />

        <div className="grid gap-6 md:grid-cols-2">
          {departments.map((dept, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <dept.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{dept.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dept.description}
                    </p>
                    <div className="mt-3 space-y-1">
                      <a
                        href={`mailto:${dept.email}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {dept.email}
                      </a>
                      <a
                        href={`tel:${dept.phone.replace(/[^+\d]/g, "")}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {dept.phone}
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* FAQ CTA */}
      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <HelpCircle className="mx-auto h-12 w-12 text-primary/40" />
          <h2 className="mt-6">Looking for Quick Answers?</h2>
          <p className="mt-4 text-muted-foreground">
            Many common questions are answered in our FAQ section. Find information
            about bidding, payments, shipping, and more.
          </p>
          <Link href="/faq">
            <Button className="mt-8 gap-2">
              Browse FAQs
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* Emergency Contact */}
      <Section background="highlight" size="lg">
        <div className="mx-auto max-w-2xl text-center">
          <h2>Need Urgent Assistance?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            For time-sensitive matters during an active auction, call our priority line.
          </p>
          <a href="tel:+12345678999">
            <Button size="lg" className="mt-8 gap-2">
              <Phone className="h-4 w-4" />
              +1 (234) 567-8999
            </Button>
          </a>
          <p className="mt-4 text-sm text-muted-foreground">
            Available during all live auction events
          </p>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
