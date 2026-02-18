import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify email — FairMate",
  description: "Verify your FairMate account email.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
