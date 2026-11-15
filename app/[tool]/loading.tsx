export default function Loading() {
  return (
    <main aria-label="Carregando ferramenta" aria-busy="true" className="min-h-[60vh] w-full bg-[var(--ns-bg)] px-4 py-6 text-[var(--ns-ink)] dark:bg-[#151A16] dark:text-[#E8E6DF] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl animate-pulse space-y-8">
        <div className="h-10 w-44 rounded-lg bg-[#E8E6DF] dark:bg-[#292E26]" />
        <div className="flex gap-2 border-b border-[#E5E2D9] pb-4 dark:border-[#343B30]">
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-10 w-24 rounded-lg bg-[#E8E6DF] dark:bg-[#292E26]" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="space-y-5 lg:col-span-7">
            <div className="h-7 w-2/5 rounded-md bg-[#E8E6DF] dark:bg-[#292E26]" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-20 rounded-lg bg-[#E8E6DF] dark:bg-[#292E26]" />)}
            </div>
          </section>
          <section className="space-y-4 lg:col-span-5">
            <div className="h-64 rounded-xl bg-[#E8E6DF] dark:bg-[#292E26]" />
            <div className="h-28 rounded-xl bg-[#E8E6DF] dark:bg-[#292E26]" />
          </section>
        </div>
      </div>
    </main>
  );
}
