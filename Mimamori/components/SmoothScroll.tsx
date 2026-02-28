'use client';

// Removed @studio-freight/react-lenis as it blocks native mouse scrolling on certain setups and React 19
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>{children}</>
  );
}
