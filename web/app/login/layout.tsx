import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in — FairMate",
  description: "Sign in to your FairMate account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
