"use client";

import { FULL_INDEX, FEATURED, SITE } from "@/lib/projects";

interface Props {
  entered: boolean;
  onSelect: (slug: string) => void;
}

export function FullIndex({ entered, onSelect }: Props) {
  return (
    <main className="fixed inset-0 z-20 overflow-hidden" data-gl-shield="">
      <div className="sr-only">
        <h1>Index — every project by {SITE.name}</h1>
        <p>
          {" "}
          Browse example directions for personal websites made with Paper Stish. Select an example
          to explore its style and imagine how you would make it your own.{" "}
        </p>
      </div>
      <div className="absolute inset-0">
        <div
          className="mx-auto flex min-h-full max-w-[42rem] s:max-w-[90rem] flex-wrap content-center items-center justify-center gap-x-24 gap-y-6 px-20"
          style={{ opacity: entered ? 1 : 0, transition: "opacity 0.3s" }}
        >
          {FULL_INDEX.map((it, i) => {
            const featured = FEATURED.find((p) => p.slug === it.href.split("/").pop());
            const delay = 0.4 + Math.min(i * 0.03, 0.55);
            return (
              <span
                key={it.title + i}
                className="relative flex"
                style={
                  entered
                    ? ({
                        animation: `full-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both`,
                      } as React.CSSProperties)
                    : undefined
                }
              >
                {it.external ? (
                  <a
                    href={it.href}
                    target="_blank"
                    rel="noopener"
                    className="pointer-events-auto cursor-pointer whitespace-nowrap text-18 s:text-30 tracking-[-0.05em] transition-opacity duration-300 hover:opacity-60"
                  >
                    {it.title}
                  </a>
                ) : (
                  <a
                    href={it.href}
                    onClick={(e) => {
                      e.preventDefault();
                      if (featured) onSelect(featured.slug);
                    }}
                    className="pointer-events-auto cursor-pointer whitespace-nowrap text-18 s:text-30 tracking-[-0.05em] transition-opacity duration-300 hover:opacity-60"
                  >
                    {it.title}
                  </a>
                )}
                <span
                  className="pointer-events-none absolute left-full top-1/2 ml-12 -translate-x-1/2 -translate-y-1/2 text-8 leading-none"
                  aria-hidden="true"
                >
                  ●
                </span>
              </span>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes full-pop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
    </main>
  );
}
