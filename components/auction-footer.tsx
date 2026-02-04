import Link from "next/link";
import { Gavel, Mail, Phone, MapPin, Shield, Lock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const footerLinks = {
  auctions: {
    title: "Auctions",
    links: [
      { label: "Upcoming Auctions", href: "/auctions" },
      { label: "Past Results", href: "/results" },
      { label: "How to Bid", href: "/how-it-works" },
      { label: "Buyer's Premium", href: "/buyers-premium" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Our Team", href: "/team" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  services: {
    title: "Services",
    links: [
      { label: "Sell With Us", href: "/consign" },
      { label: "Valuations", href: "/consign#valuations" },
      { label: "Private Sales", href: "/consign#private-sales" },
      { label: "Collection Management", href: "/consign#collection" },
    ],
  },
  support: {
    title: "Support",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Shipping & Delivery", href: "/shipping" },
      { label: "Returns Policy", href: "/returns" },
      { label: "Authenticity Guarantee", href: "/authenticity" },
    ],
  },
};

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
];

const trustFeatures = [
  { icon: Shield, label: "Authenticity Guaranteed" },
  { icon: Lock, label: "Secure Payments" },
  { icon: Award, label: "Expert Curation" },
];

export function AuctionFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      {/* Main footer content */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand & Newsletter */}
          <div className="lg:col-span-4">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Gavel className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-lg font-semibold leading-none tracking-tight">
                  AUCTION
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  House
                </span>
              </div>
            </Link>

            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-sm">
              A trusted marketplace for fine art, antiques, and collectibles.
              Expert curation, secure transactions, and exceptional service since 2020.
            </p>

            {/* Newsletter signup */}
            <div className="mt-6">
              <p className="text-sm font-medium text-foreground">
                Subscribe to our newsletter
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Get auction alerts and collecting insights.
              </p>
              <form className="mt-3 flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1"
                />
                <Button type="submit" size="default">
                  Subscribe
                </Button>
              </form>
            </div>

            {/* Contact info */}
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <a
                href="mailto:info@auctionhouse.com"
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
                info@auctionhouse.com
              </a>
              <a
                href="tel:+1234567890"
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4" />
                +1 (234) 567-890
              </a>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>123 Auction Street, New York, NY 10001</span>
              </div>
            </div>
          </div>

          {/* Link columns */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {Object.values(footerLinks).map((section) => (
                <div key={section.title}>
                  <h3 className="font-medium text-foreground">{section.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-t border-border bg-section-alt">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {trustFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <feature.icon className="h-4 w-4 text-primary" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
            <p>© {currentYear} Auction House. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
