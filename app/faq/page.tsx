"use client";

import { useState } from "react";
import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  Gavel,
  CreditCard,
  Truck,
  Shield,
  User,
  HelpCircle,
  ArrowRight,
  Package,
} from "lucide-react";
import Link from "next/link";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";
import { cn } from "@/lib/utils";

// FAQ Categories
const faqCategories = [
  {
    id: "buying",
    title: "Buying & Bidding",
    icon: Gavel,
    faqs: [
      {
        question: "How do I register to bid?",
        answer: "Click 'Sign Up' in the navigation bar to create a free account. You'll need to verify your email address and add a valid payment method before you can place bids. Registration typically takes just a few minutes.",
      },
      {
        question: "What is a maximum bid?",
        answer: "A maximum bid is the highest amount you're willing to pay for an item. Our system will automatically bid on your behalf in the minimum increments necessary to keep you in the lead, up to your maximum. Other bidders won't see your maximum—only the current bid.",
      },
      {
        question: "Can I cancel a bid?",
        answer: "Bids are binding commitments and generally cannot be retracted. If you believe you made an error, contact us immediately at bidding@auctionhouse.com. Bid retractions are granted only in exceptional circumstances and at our sole discretion.",
      },
      {
        question: "What happens if I'm outbid?",
        answer: "You'll receive an email notification whenever you're outbid on an item you're following. You can then decide whether to place a higher bid. We recommend setting your maximum bid at the true highest amount you're willing to pay to avoid missing out.",
      },
      {
        question: "How do bid increments work?",
        answer: "Bid increments are predetermined amounts by which bids must increase. For example, items under $100 increase in $5 increments, while items over $10,000 increase in $250 increments. This ensures orderly bidding and fair competition.",
      },
      {
        question: "Can I preview items before bidding?",
        answer: "Yes! We offer preview appointments before most auctions. Contact us to schedule a time to view lots in person at our gallery. We can also arrange video calls for remote previews of specific items.",
      },
      {
        question: "What is a reserve price?",
        answer: "A reserve is the minimum price a consignor will accept. If bidding doesn't reach the reserve, the item won't sell. Lots with reserves are marked in the catalog. We work to set realistic reserves that allow items to sell.",
      },
    ],
  },
  {
    id: "selling",
    title: "Selling & Consigning",
    icon: Package,
    faqs: [
      {
        question: "How do I consign items for auction?",
        answer: "Start by submitting photos and descriptions through our consignment form or emailing consign@auctionhouse.com. Our specialists will review your submission and provide a complimentary auction estimate. If you decide to proceed, we'll handle photography, cataloging, marketing, and the entire auction process.",
      },
      {
        question: "What is the seller's commission?",
        answer: "Our seller's commission varies based on the value and type of consignment. We offer competitive rates and are happy to discuss terms for your specific situation. Contact us for a personalized quote—there's no obligation.",
      },
      {
        question: "How long does the consignment process take?",
        answer: "From initial submission to auction typically takes 4-8 weeks, depending on our auction calendar and the time needed for research and cataloging. For time-sensitive situations, we can sometimes expedite the process.",
      },
      {
        question: "Can I set a minimum price (reserve)?",
        answer: "Yes, you can set a reserve price below which the item won't sell. We'll work with you to determine an appropriate reserve that protects your interests while giving the item the best chance to sell.",
      },
      {
        question: "When do I get paid after my item sells?",
        answer: "Payment is issued within 30 days of the auction closing, after we've collected payment from the buyer. We handle all buyer communications and payment collection on your behalf.",
      },
      {
        question: "What if my item doesn't sell?",
        answer: "If an item doesn't meet its reserve, we'll discuss options including adjusting the reserve for a future auction, private sale, or return of the item. There's no charge for unsold items, though return shipping may apply.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & Fees",
    icon: CreditCard,
    faqs: [
      {
        question: "What is the buyer's premium?",
        answer: "The buyer's premium is 25% of the hammer price, added to all winning bids. This covers auction services including cataloging, marketing, insurance, and platform operations. The total you pay is the hammer price plus the 25% premium, plus any applicable shipping.",
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept all major credit cards (Visa, Mastercard, American Express), bank wire transfers, and ACH payments. For purchases over $10,000, we may require wire transfer. Payment is due within 7 days of receiving your invoice.",
      },
      {
        question: "Are there any other fees?",
        answer: "Beyond the buyer's premium, you may be responsible for shipping and handling costs, which are quoted separately. Some jurisdictions require sales tax collection. There are no hidden fees—your invoice will clearly itemize all charges.",
      },
      {
        question: "Can I pay in installments?",
        answer: "For larger purchases, we can sometimes arrange payment plans. Contact us before the payment deadline to discuss options. Payment plans must be arranged in advance and may require a deposit.",
      },
      {
        question: "What happens if I don't pay?",
        answer: "Non-payment is a serious matter. Failure to pay may result in cancellation of the sale, loss of bidding privileges, collection actions, and/or legal proceedings. If you're having difficulty, please contact us immediately—we're often able to work out solutions.",
      },
      {
        question: "Do you charge sales tax?",
        answer: "We collect sales tax where required by law. Tax is calculated based on the shipping destination. Items shipped outside the US may be subject to import duties and taxes in the destination country, which are the buyer's responsibility.",
      },
    ],
  },
  {
    id: "shipping",
    title: "Shipping & Delivery",
    icon: Truck,
    faqs: [
      {
        question: "How is shipping handled?",
        answer: "We work with specialized fine art shippers and major carriers depending on the item. All shipments are professionally packed and fully insured. You'll receive tracking information once your item ships.",
      },
      {
        question: "How much does shipping cost?",
        answer: "Shipping costs vary based on size, weight, value, and destination. We provide shipping quotes before you commit to payment. For fragile or high-value items, we may require white-glove delivery services.",
      },
      {
        question: "Do you ship internationally?",
        answer: "Yes, we ship worldwide. International buyers are responsible for any import duties, taxes, and customs fees in their country. We provide all necessary export documentation.",
      },
      {
        question: "Can I pick up my items instead?",
        answer: "Yes, local pickup is available at our gallery by appointment. Pickup must be arranged within 14 days of payment. Please bring a valid ID that matches the name on your account.",
      },
      {
        question: "What if my item arrives damaged?",
        answer: "All shipments are fully insured. If you receive a damaged item, document the damage with photos immediately and contact us within 48 hours. Do not discard any packing materials. We'll guide you through the claims process.",
      },
      {
        question: "How long does shipping take?",
        answer: "Domestic shipments typically arrive within 5-10 business days. International shipping varies by destination, usually 2-4 weeks. White-glove deliveries are scheduled based on your availability.",
      },
    ],
  },
  {
    id: "authenticity",
    title: "Authenticity & Condition",
    icon: Shield,
    faqs: [
      {
        question: "How do you authenticate items?",
        answer: "Our specialists research each item using scholarly resources, provenance documentation, and their expertise. For certain categories, we may engage independent experts or scientific analysis. We stand behind our descriptions and attributions.",
      },
      {
        question: "What is a condition report?",
        answer: "A condition report is a detailed written description of an item's physical state, noting any damage, repairs, or wear. We provide condition reports on request for any lot. High-resolution photos showing condition details are included in all listings.",
      },
      {
        question: "What if an item isn't as described?",
        answer: "We stand behind our descriptions. If you believe an item is materially different from its catalog description, contact us within 5 days of receipt. We'll review the matter and may offer a return and refund at our discretion.",
      },
      {
        question: "Do items come with certificates of authenticity?",
        answer: "Where applicable, items include any existing documentation such as certificates, receipts, or provenance records. We provide detailed catalog descriptions and are happy to share our research and findings.",
      },
      {
        question: "What does 'as is' mean?",
        answer: "All items are sold 'as is,' meaning in their current condition with any faults noted in the description. This is standard in the auction industry. We encourage previews and condition report requests before bidding.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & Registration",
    icon: User,
    faqs: [
      {
        question: "Is registration free?",
        answer: "Yes, creating an account is completely free. You'll only pay if you win an auction (hammer price + buyer's premium + shipping).",
      },
      {
        question: "Why do I need a payment method on file?",
        answer: "A valid payment method ensures that winning bidders can fulfill their commitments. Your card is not charged when you bid—only when you win. This protects the integrity of our auctions for all participants.",
      },
      {
        question: "How do I update my account information?",
        answer: "Log in and visit your Account Settings to update your contact information, password, or payment methods. For changes to your registered name, please contact our support team.",
      },
      {
        question: "Can I have multiple accounts?",
        answer: "No, each person may have only one account. Multiple accounts may result in suspension. If you need to close an account and open a new one, please contact us.",
      },
      {
        question: "How do I delete my account?",
        answer: "Contact us at support@auctionhouse.com to request account deletion. Note that you must settle any outstanding invoices before your account can be closed. We retain certain records as required by law.",
      },
      {
        question: "I forgot my password. What do I do?",
        answer: "Click 'Log In' then 'Forgot Password' to receive a password reset link via email. If you don't receive the email, check your spam folder or contact support for assistance.",
      },
    ],
  },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Filter FAQs based on search
  const filteredCategories = faqCategories.map((category) => ({
    ...category,
    faqs: category.faqs.filter(
      (faq) =>
        searchQuery === "" ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((category) => category.faqs.length > 0);

  const totalResults = filteredCategories.reduce((acc, cat) => acc + cat.faqs.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      {/* Hero */}
      <PageHero
        title="Frequently Asked Questions"
        subtitle="Find answers to common questions about bidding, selling, payments, shipping, and more."
      />

      {/* Search */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="mx-auto max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for answers..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm text-muted-foreground text-center">
                {totalResults} result{totalResults !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Category Navigation */}
      <div className="border-b border-border bg-background sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-3 overflow-x-auto">
            <Button
              variant={activeCategory === null ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(null)}
              className="whitespace-nowrap"
            >
              All Topics
            </Button>
            {faqCategories.map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className="whitespace-nowrap gap-2"
              >
                <category.icon className="h-4 w-4" />
                {category.title}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ Content */}
      <Section>
        <div className="mx-auto max-w-3xl">
          {filteredCategories.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-4">No Results Found</h3>
                <p className="mt-2 text-muted-foreground">
                  Try a different search term or browse by category.
                </p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {filteredCategories
                .filter((cat) => activeCategory === null || cat.id === activeCategory)
                .map((category) => (
                  <div key={category.id} id={category.id}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <category.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-xl font-semibold">{category.title}</h2>
                    </div>

                    <Card className="border-border/50">
                      <CardContent className="p-0">
                        <Accordion type="single" collapsible className="w-full">
                          {category.faqs.map((faq, index) => (
                            <AccordionItem
                              key={index}
                              value={`${category.id}-${index}`}
                              className={cn(
                                "border-border/50",
                                index === category.faqs.length - 1 && "border-b-0"
                              )}
                            >
                              <AccordionTrigger className="px-6 py-4 text-left hover:no-underline hover:bg-muted/50">
                                <span className="font-medium">{faq.question}</span>
                              </AccordionTrigger>
                              <AccordionContent className="px-6 pb-4">
                                <p className="text-muted-foreground leading-relaxed">
                                  {faq.answer}
                                </p>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Section>

      {/* Still Have Questions */}
      <Section background="alt">
        <div className="mx-auto max-w-2xl text-center">
          <HelpCircle className="mx-auto h-12 w-12 text-primary/40" />
          <h2 className="mt-6">Still Have Questions?</h2>
          <p className="mt-4 text-muted-foreground">
            Can't find what you're looking for? Our team is happy to help with any
            questions about our auctions, services, or process.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/contact">
              <Button className="gap-2">
                Contact Us
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button variant="outline">
                How It Works
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* Quick Links */}
      <Section>
        <SectionHeader
          title="Helpful Resources"
          subtitle="More information to help you get started."
          align="center"
        />
        <div className="grid gap-4 md:grid-cols-3 max-w-3xl mx-auto">
          <Link href="/how-it-works">
            <Card className="border-border/50 h-full hover:border-border hover:shadow-md transition-all">
              <CardContent className="p-6 text-center">
                <Gavel className="mx-auto h-8 w-8 text-primary" />
                <h4 className="mt-3 font-medium">How to Bid</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Step-by-step bidding guide
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/consign">
            <Card className="border-border/50 h-full hover:border-border hover:shadow-md transition-all">
              <CardContent className="p-6 text-center">
                <Package className="mx-auto h-8 w-8 text-primary" />
                <h4 className="mt-3 font-medium">Sell With Us</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Learn about consigning
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/buyers-premium">
            <Card className="border-border/50 h-full hover:border-border hover:shadow-md transition-all">
              <CardContent className="p-6 text-center">
                <CreditCard className="mx-auto h-8 w-8 text-primary" />
                <h4 className="mt-3 font-medium">Fees & Pricing</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Transparent fee schedule
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
