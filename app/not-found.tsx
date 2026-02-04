import Link from "next/link";
import { AuctionNav } from "@/components/auction-nav";
import { AuctionFooter } from "@/components/auction-footer";
import { Button } from "@/components/ui/button";
import { Search, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuctionNav />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="text-8xl font-serif font-bold text-primary/20">404</div>
          <h1 className="mt-4 text-2xl font-semibold">Page Not Found</h1>
          <p className="mt-4 text-muted-foreground">
            Sorry, we couldn't find the page you're looking for. It may have been
            moved or no longer exists.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="w-full sm:w-auto gap-2">
                <Home className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <Link href="/auctions">
              <Button variant="outline" className="w-full sm:w-auto gap-2">
                <Search className="h-4 w-4" />
                Browse Auctions
              </Button>
            </Link>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Looking for something specific?{" "}
              <Link href="/contact" className="text-primary hover:underline">
                Contact our team
              </Link>{" "}
              and we'll help you find it.
            </p>
          </div>
        </div>
      </main>

      <AuctionFooter />
    </div>
  );
}
