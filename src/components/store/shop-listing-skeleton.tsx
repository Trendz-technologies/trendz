import { ProductGridSkeleton } from "./product-card";

/**
 * Loading placeholder that mirrors the listing layout (header, toolbar, filter column, 3-up grid).
 * `banner` is for category pages, whose header is a framed banner rather than a big title.
 */
export function ListingSkeleton({ breadcrumb = true, banner = false }: { breadcrumb?: boolean; banner?: boolean }) {
  return (
    <div>
      {banner ? (
        <div className="container-x pb-8 pt-6 md:pb-10 md:pt-8">
          {breadcrumb && <div className="skeleton h-3 w-44 rounded-full" />}
          <div className="skeleton mt-5 h-[26rem] rounded-[2rem] md:mt-6 md:h-80 lg:h-96 lg:rounded-[2.5rem]" />
        </div>
      ) : (
        <div className="container-x pb-8 pt-8 md:pb-12 md:pt-12">
          {breadcrumb && <div className="skeleton mb-8 h-3 w-44 rounded-full md:mb-12" />}
          <div className="w-full max-w-2xl">
            <div className="skeleton h-2.5 w-24 rounded-full" />
            <div className="skeleton mt-4 h-[clamp(2.75rem,8vw,6.5rem)] w-4/5 rounded-3xl" />
          </div>
        </div>
      )}

      <div className="container-x">
        <div className="flex items-center justify-between gap-3 border-y border-black/[0.07] py-3">
          <div className="skeleton h-10 w-28 rounded-full lg:w-44" />
          <div className="skeleton h-10 w-40 rounded-full sm:w-56" />
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-14">
          <div className="hidden lg:block">
            <div className="skeleton mb-6 h-2.5 w-20 rounded-full" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-b border-black/[0.07] py-5 first:pt-0">
                <div className="skeleton h-2.5 w-24 rounded-full" />
                <div className="mt-4 flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <div key={j} className="skeleton h-9 w-12 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Same grid as the listing: three columns beside the filter column. */}
          <div className="min-w-0">
            <ProductGridSkeleton count={9} columns={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
