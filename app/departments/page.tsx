import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Department = {
    id: string;
    name: string;
    description: string;
    image: string;
    itemCount: number;
    upcomingAuctions: number;
};

// Mock departments data - similar to Christie's departments page
const mockDepartments: Department[] = [
    {
        id: "contemporary-art",
        name: "Contemporary Art",
        description:
            "Works by leading contemporary artists from the 21st century, featuring cutting-edge pieces that define today's art market.",
        image: "/modern-contemporary-art-auction.jpg",
        itemCount: 1240,
        upcomingAuctions: 3,
    },
    {
        id: "impressionist-modern",
        name: "Impressionist & Modern Art",
        description:
            "Masterpieces from the Impressionist movement and early 20th century modernism, including works by renowned European masters.",
        image: "/impressionist-art-auction.jpg",
        itemCount: 856,
        upcomingAuctions: 2,
    },
    {
        id: "old-masters",
        name: "Old Masters",
        description:
            "Exceptional paintings and drawings from the 14th to 18th centuries, representing the finest examples of European art history.",
        image: "/old-masters-paintings-auction.jpg",
        itemCount: 432,
        upcomingAuctions: 1,
    },
    {
        id: "jewelry-watches",
        name: "Fine Jewelry & Watches",
        description:
            "Exquisite jewelry pieces and luxury timepieces from prestigious makers, featuring rare gems and exceptional craftsmanship.",
        image: "/fine-jewelry-watches-auction.jpg",
        itemCount: 2100,
        upcomingAuctions: 4,
    },
    {
        id: "asian-art",
        name: "Asian Art",
        description:
            "Rare and important works of art from across Asia, including Chinese ceramics, Japanese prints, and Southeast Asian sculptures.",
        image: "/asian-art-ceramics-auction.jpg",
        itemCount: 678,
        upcomingAuctions: 2,
    },
    {
        id: "decorative-arts",
        name: "Design & Decorative Arts",
        description:
            "Furniture, decorative objects, and design pieces from the 18th century to the present, showcasing exceptional craftsmanship.",
        image: "/design-decorative-arts-auction.jpg",
        itemCount: 945,
        upcomingAuctions: 2,
    },
];

export default function DepartmentsPage() {
    return (
        <div className="min-h-screen">
            <AuctionNav />

            {/* Hero Section */}
            <section className="border-b border-border/50 bg-muted/20 py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <h1 className="font-serif text-4xl font-light tracking-tight md:text-5xl">
                        Departments
                    </h1>
                    <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                        Explore our specialized departments, each dedicated to curating
                        exceptional works across different categories of art, antiques, and
                        collectibles.
                    </p>
                </div>
            </section>

            {/* Departments Grid */}
            <section className="container mx-auto px-4 py-20 md:py-28">
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {mockDepartments.map((department) => (
                        <Link
                            key={department.id}
                            href={`/departments/${department.id}`}
                            className="group"
                        >
                            <Card className="flex h-full flex-col overflow-hidden border-border/50 transition-all hover:border-border hover:shadow-lg">
                                <div className="relative aspect-[4/3] overflow-hidden">
                                    <img
                                        src={department.image}
                                        alt={department.name}
                                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                                </div>
                                <CardContent className="flex flex-1 flex-col p-6">
                                    <h2 className="font-serif text-2xl font-normal leading-tight tracking-tight">
                                        {department.name}
                                    </h2>
                                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                                        {department.description}
                                    </p>
                                    <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
                                        <div className="space-y-1">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Items Available
                                            </p>
                                            <p className="text-lg font-medium">
                                                {department.itemCount.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Upcoming Sales
                                            </p>
                                            <p className="text-lg font-medium">
                                                {department.upcomingAuctions}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center text-sm font-medium text-foreground group-hover:text-accent-foreground">
                                        Explore Department
                                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="border-y border-border/50 bg-muted/20 py-20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="font-serif text-3xl font-light tracking-tight md:text-4xl">
                        Can't Find What You're Looking For?
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted-foreground">
                        Our specialists are available to help you discover pieces across all
                        departments or assist with consignment inquiries.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link href="/">
                            <button className="rounded-md border border-border bg-background px-6 py-2.5 text-sm font-normal transition-colors hover:bg-accent">
                                View All Auctions
                            </button>
                        </Link>
                        <button className="rounded-md border border-border bg-background px-6 py-2.5 text-sm font-normal transition-colors hover:bg-accent">
                            Contact a Specialist
                        </button>
                    </div>
                </div>
            </section>

            <AuctionFooter />
        </div>
    );
}

