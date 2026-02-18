import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import FeedbackForm from "./FeedbackForm";

const PAGE_BG = "#252525";

export const metadata: Metadata = {
  title: "Feedback — FairMate",
  description: "Share ideas to improve FairMate.",
};

export default async function FeedbackPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/feedback");

  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-10"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-2xl min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Give us your feedback
        </h1>
        <p className="mt-2 text-sm text-stone-400 sm:text-base">
          Tell us what we should improve next. We read every submission.
        </p>
        <FeedbackForm />
      </div>
    </main>
  );
}
