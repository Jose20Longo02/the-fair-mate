import SupportForm from "./SupportForm";

const PAGE_BG = "#252525";

export default function SupportPage() {
  return (
    <main
      className="min-h-[calc(100vh-4rem)] w-full flex-1 overflow-x-hidden px-8 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:py-10 md:min-h-[calc(100vh-6rem)] md:px-10 md:py-12"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto max-w-xl min-w-0 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
          Need any help?
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-stone-400 sm:mt-5 sm:text-lg md:mt-6">
          Fill out the following form and we will try our best to help you as fast as possible.
        </p>
        <SupportForm />
      </div>
    </main>
  );
}
