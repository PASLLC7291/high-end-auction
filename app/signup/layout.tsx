import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | Auction House",
  description: "Create your free Auction House account to start bidding on curated auctions.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
