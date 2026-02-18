import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in — FairMate",
  description: "Sign in to your FairMate account.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
