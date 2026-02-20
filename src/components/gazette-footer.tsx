interface GazetteFooterProps {
  sourcesToday: number;
  libraryTotal: number;
  librarySurfaced: number;
}

export function GazetteFooter({
  sourcesToday,
  libraryTotal,
  librarySurfaced,
}: GazetteFooterProps) {
  return (
    <div className="text-center py-10 mt-8 border-t border-stone-100">
      <p className="text-base font-medium text-stone-700 mb-2">
        That's it for today.
      </p>
      <p className="text-sm text-stone-400">
        {sourcesToday} sources · {libraryTotal.toLocaleString()} in your library
        · {librarySurfaced} surfaced so far
      </p>
    </div>
  );
}
