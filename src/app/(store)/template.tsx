/**
 * Re-mounts on every navigation, so each storefront page eases in. A CSS
 * animation (not JavaScript) so content is never hidden while scripts load.
 */
export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
