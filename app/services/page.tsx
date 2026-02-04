import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Gavel,
    Search,
    TrendingUp,
    Shield,
    Truck,
    FileText,
    Users,
    Globe,
    Phone,
    Mail,
    MapPin,
} from "lucide-react";
import Link from "next/link";

const services = [
    {
        icon: Gavel,
        title: "Consignment",
        description:
            "Partner with our experts to sell your fine art, antiques, and collectibles. We handle everything from cataloguing to marketing, ensuring maximum exposure and optimal results.",
        features: [
            "Complimentary valuations",
            "Global marketing reach",
            "Dedicated specialist support",
            "Competitive commission rates",
        ],
    },
    {
        icon: Search,
        title: "Valuations & Appraisals",
        description:
            "Our team of specialists provides professional valuations for insurance, estate planning, or sale purposes. We offer both in-person and digital appraisal services.",
        features: [
            "Insurance valuations",
            "Estate appraisals",
            "Fair market assessments",
            "Certified documentation",
        ],
    },
    {
        icon: TrendingUp,
        title: "Private Sales",
        description:
            "For clients seeking discretion, our private sales team facilitates confidential transactions between buyers and sellers, with access to our extensive global network.",
        features: [
            "Confidential transactions",
            "Global collector network",
            "Flexible timelines",
            "Personalized service",
        ],
    },
    {
        icon: Shield,
        title: "Collection Management",
        description:
            "Comprehensive services to help you build, manage, and preserve your collection. From acquisition advice to conservation, we're your trusted partner.",
        features: [
            "Acquisition guidance",
            "Cataloguing services",
            "Conservation referrals",
            "Storage solutions",
        ],
    },
    {
        icon: Truck,
        title: "Shipping & Logistics",
        description:
            "Our logistics team ensures your purchases arrive safely. We coordinate with trusted art handlers and shippers worldwide for secure transport.",
        features: [
            "White-glove handling",
            "Climate-controlled transport",
            "International shipping",
            "Full insurance coverage",
        ],
    },
    {
        icon: FileText,
        title: "Research & Authentication",
        description:
            "Access our research library and authentication services. Our specialists provide provenance research, condition reports, and authentication support.",
        features: [
            "Provenance research",
            "Condition reporting",
            "Authentication support",
            "Historical documentation",
        ],
    },
];

const specialists = [
    {
        name: "Dr. Elizabeth Hartley",
        role: "Head of Impressionist & Modern Art",
        email: "e.hartley@prestige.com",
    },
    {
        name: "Marcus Chen",
        role: "Director of Asian Art",
        email: "m.chen@prestige.com",
    },
    {
        name: "Isabella Romano",
        role: "Senior Specialist, Jewelry & Watches",
        email: "i.romano@prestige.com",
    },
    {
        name: "James Whitfield",
        role: "Head of Decorative Arts",
        email: "j.whitfield@prestige.com",
    },
];

export default function ServicesPage() {
    return (
        <div className="min-h-screen">
            <AuctionNav />

            {/* Hero Section */}
            <section className="relative border-b border-border bg-muted/30 py-20 md:py-28">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-3xl text-center">
                        <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
                            Our Services
                        </h1>
                        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                            From consignment to collection management, we offer a comprehensive
                            suite of services to meet the needs of collectors, estates, and
                            institutions worldwide.
                        </p>
                        <div className="mt-8 flex flex-wrap justify-center gap-4">
                            <Button size="lg">Schedule a Consultation</Button>
                            <Button size="lg" variant="outline">
                                Contact a Specialist
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services Grid */}
            <section className="container mx-auto px-4 py-20 md:py-28">
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {services.map((service) => (
                        <Card
                            key={service.title}
                            className="group border-border/50 transition-all hover:border-border hover:shadow-md"
                        >
                            <CardHeader>
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                    <service.icon className="h-6 w-6" />
                                </div>
                                <CardTitle className="font-serif text-xl font-normal">
                                    {service.title}
                                </CardTitle>
                                <CardDescription className="text-base leading-relaxed">
                                    {service.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {service.features.map((feature) => (
                                        <li
                                            key={feature}
                                            className="flex items-center gap-2 text-sm text-muted-foreground"
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Specialists Section */}
            <section className="border-y border-border/50 bg-muted/10 py-20 md:py-28">
                <div className="container mx-auto px-4">
                    <div className="mb-14 text-center">
                        <h2 className="font-serif text-3xl font-light tracking-tight md:text-4xl">
                            Meet Our Specialists
                        </h2>
                        <p className="mt-4 text-muted-foreground">
                            Our team of experts is here to guide you through every step of your
                            journey
                        </p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {specialists.map((specialist) => (
                            <Card
                                key={specialist.name}
                                className="border-border/50 text-center transition-all hover:border-border hover:shadow-sm"
                            >
                                <CardContent className="pt-6">
                                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                                        <Users className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="font-serif text-lg font-medium">
                                        {specialist.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {specialist.role}
                                    </p>
                                    <a
                                        href={`mailto:${specialist.email}`}
                                        className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                    >
                                        <Mail className="h-3 w-3" />
                                        Contact
                                    </a>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section className="container mx-auto px-4 py-20 md:py-28">
                <div className="grid gap-12 lg:grid-cols-2">
                    <div>
                        <h2 className="font-serif text-3xl font-light tracking-tight md:text-4xl">
                            Get in Touch
                        </h2>
                        <p className="mt-4 leading-relaxed text-muted-foreground">
                            Whether you're looking to consign, seeking a valuation, or simply
                            have questions about our services, our team is ready to assist you.
                        </p>

                        <div className="mt-10 space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Phone className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-medium">Phone</h3>
                                    <p className="text-muted-foreground">+1 (555) 123-4567</p>
                                    <p className="text-sm text-muted-foreground">
                                        Mon–Fri, 9am–6pm EST
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-medium">Email</h3>
                                    <p className="text-muted-foreground">info@prestige.com</p>
                                    <p className="text-sm text-muted-foreground">
                                        We respond within 24 hours
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-medium">Headquarters</h3>
                                    <p className="text-muted-foreground">
                                        1234 Madison Avenue
                                        <br />
                                        New York, NY 10021
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Globe className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-medium">Global Offices</h3>
                                    <p className="text-muted-foreground">
                                        London · Paris · Hong Kong · Tokyo
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-muted/10 p-8">
                        <h3 className="font-serif text-xl font-medium">
                            Request a Consultation
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Fill out the form and a specialist will contact you shortly.
                        </p>

                        <form className="mt-6 space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium">First Name</label>
                                    <input
                                        type="text"
                                        className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="John"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Last Name</label>
                                    <input
                                        type="text"
                                        className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Email</label>
                                <input
                                    type="email"
                                    className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">Service Interest</label>
                                <select className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                                    <option value="">Select a service...</option>
                                    <option value="consignment">Consignment</option>
                                    <option value="valuation">Valuations & Appraisals</option>
                                    <option value="private-sales">Private Sales</option>
                                    <option value="collection">Collection Management</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Message</label>
                                <textarea
                                    className="mt-1.5 h-24 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Tell us about your collection or inquiry..."
                                />
                            </div>

                            <Button type="submit" className="w-full">
                                Submit Request
                            </Button>
                        </form>
                    </div>
                </div>
            </section>

            <AuctionFooter />
        </div>
    );
}

