import type { Metadata, Viewport } from "next";
import { Cinzel, Great_Vibes, Inter, Noto_Sans_Tamil, Noto_Serif_Tamil, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import { BRAND } from "@/lib/brand";
import { getAppearance } from "@/lib/server-api";
import { shopperModeScript, themeStyle, themeVars } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Editorial serif for headings.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
// Engraved capitals, like the lettering in the Trendz logo (wordmark, small labels).
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap", weight: ["500", "600", "700"] });
// Script used for the tagline.
const greatVibes = Great_Vibes({ subsets: ["latin"], variable: "--font-greatvibes", display: "swap", weight: "400" });
// Tamil glyphs for the storefront's language switch. They sit behind the Latin fonts in each stack
// and are not preloaded, so a browser only downloads them when a page actually shows Tamil.
const tamilSans = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-tamil", display: "swap", preload: false });
const tamilSerif = Noto_Serif_Tamil({ subsets: ["tamil"], variable: "--font-tamil-serif", display: "swap", preload: false });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
const STORE = process.env.NEXT_PUBLIC_STORE_NAME ?? BRAND.fullName;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${STORE} — ${BRAND.tagline}`, template: `%s | ${STORE}` },
  description: `${BRAND.promise}: kurti sets, anarkalis, lehengas, party wear, western wear and kids wear from ${BRAND.fullName}.`,
  openGraph: { type: "website", siteName: STORE, locale: "en_IN" },
  robots: { index: true, follow: true },
};

// Browser chrome follows the saved theme (Admin → Appearance).
export async function generateViewport(): Promise<Viewport> {
  const appearance = await getAppearance();
  return { themeColor: themeVars(appearance)["--color-offwhite"], colorScheme: appearance.mode, width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every colour token is set here, on <html>, so the first paint already has the saved theme.
  // A shopper who picked the other mode in the storefront header gets it from the script below,
  // which changes these attributes before React loads: hence suppressHydrationWarning.
  const appearance = await getAppearance();
  return (
    <html lang="en-IN" data-mode={appearance.mode} suppressHydrationWarning className={`${inter.variable} ${playfair.variable} ${cinzel.variable} ${greatVibes.variable} ${tamilSans.variable} ${tamilSerif.variable}`} style={themeStyle(appearance)}>
      <body className="min-h-screen bg-offwhite font-sans text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: shopperModeScript(appearance) }} />
        <Providers appearance={appearance}>{children}</Providers>
      </body>
    </html>
  );
}
