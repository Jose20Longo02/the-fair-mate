import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test game — FairMate",
  description: "Internal testing page.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TestGameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
