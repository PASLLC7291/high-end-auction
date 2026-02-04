import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { PageHero, Section, SectionHeader } from "@/components/trust/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Truck,
  Package,
  Globe,
  Shield,
  Clock,
  CheckCircle,
  MapPin,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Shipping & Delivery | Auction House",
  description: "Information about shipping, delivery, and collection options.",
};

const shippingOptions = [
  {
    icon: Truck,
    title: "Standard Shipping",
    description: "Fully insured ground shipping for most items",
    details: ["5-10 business days", "Signature required", "Full insurance"],
  },
  {
    icon: Package,
    title: "White-Glove Delivery",
    description: "Premium service with professional art handlers",
    details: ["Custom crating", "Inside delivery", "Placement & unpacking"],
  },
  {
    icon: MapPin,
    title: "Local Pickup",
    description: "Collect your items from our facility",
    details: ["No shipping cost", "Appointment required", "ID verification"],
  },
  {
    icon: Globe,
    title: "International Shipping",
    description: "Worldwide delivery with customs handling",
    details: ["All destinations", "Customs documentation", "Import assistance"],
  },
];

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-background">
      <AuctionNav />

      <PageHero
        title="Shipping & Delivery"
        subtitle="Safe, insured delivery of your purchases to anywhere in the world."
      />

      <Section>
        <SectionHeader
          title="Shipping Options"
          subtitle="Choose the delivery method that works best for you."
          align="center"
        />

        <div className="grid gap-6 md:grid-cols-2">
          {shippingOptions.map((option, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <option.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{option.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                    <ul className="mt-3 space-y-1">
                      {option.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-primary" />
                          {detail}
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

      <Section background="alt">
        <div className="mx-auto max-w-3xl prose prose-gray">
          <h2>Shipping Process</h2>

          <h3>1. Quote Request</h3>
          <p>
            After your purchase, our shipping team will contact you with a quote based
            on your item(s) and delivery location. Quotes typically arrive within
            2-3 business days of payment.
          </p>

          <h3>2. Professional Packing</h3>
          <p>
            All items are carefully packed by our trained art handlers using
            conservation-grade materials. Fragile and valuable items receive custom
            crating for maximum protection.
          </p>

          <h3>3. Insured Transit</h3>
          <p>
            Every shipment is fully insured for the purchase price. We work with
            specialized fine art shippers who understand the care required for
            valuable items.
          </p>

          <h3>4. Delivery & Signature</h3>
          <p>
            All deliveries require signature confirmation. For white-glove service,
            our team will coordinate a delivery appointment and handle placement
            in your home.
          </p>

          <Card className="not-prose my-8 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Shield className="h-6 w-6 text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">Full Insurance Coverage</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Every shipment is insured for the full purchase price from the
                    moment it leaves our facility until delivery is confirmed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h2>Collection Timeframes</h2>
          <p>
            Items must be collected or shipping arranged within 14 days of payment.
            After this period, storage fees of $25 per day may apply.
          </p>

          <h2>International Buyers</h2>
          <p>
            We ship worldwide and can assist with customs documentation. Please note:
          </p>
          <ul>
            <li>Import duties and taxes are the buyer's responsibility</li>
            <li>Some items may require export licenses</li>
            <li>Certain materials (ivory, CITES species) have shipping restrictions</li>
          </ul>

          <h2>Questions?</h2>
          <p>
            For shipping questions or to request a quote before bidding, please{" "}
            <Link href="/contact" className="text-primary hover:underline">
              contact our shipping department
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <Clock className="h-12 w-12 mx-auto text-primary/40" />
          <h2 className="mt-6">Need a Shipping Quote?</h2>
          <p className="mt-4 text-muted-foreground">
            Contact us before bidding to get an estimate on shipping costs
            to your location.
          </p>
          <Link href="/contact">
            <Button className="mt-6">Request Quote</Button>
          </Link>
        </div>
      </Section>

      <AuctionFooter />
    </div>
  );
}
