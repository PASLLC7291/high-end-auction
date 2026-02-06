import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In | Auction House",
  description: "Sign in to your Auction House account to bid, manage your watchlist, and track your purchases.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
