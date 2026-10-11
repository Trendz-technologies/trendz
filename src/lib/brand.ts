/**
 * Brand facts shown on the storefront (taken from the shop's own banner and
 * flyer). The phone number, Instagram handle and address are edited in
 * Admin → CMS → Contact us; the ones here are shown only when the API cannot
 * supply them (see lib/cms.ts).
 */
export const BRAND = {
  name: "Trendz",
  descriptor: "Women's Wear",
  fullName: "Trendz Women's Wear",
  tagline: "Luxury in Every Stitch.",
  promise: "Fashion for every you",
  /** Collections the boutique is known for. */
  collections: ["Kurti Sets", "Anarkali", "Western Wear", "Lehenga", "Party Wear", "Kids Wear"],
  phone: "+91 93607 34597",
  phoneHref: "tel:+919360734597",
  whatsappHref: "https://wa.me/919360734597",
  instagram: "trendz_womenswear_",
  instagramHref: "https://www.instagram.com/trendz_womenswear_/",
  address: ["Shop No. 724, Uthukuli Road", "Kunnathur – 638 103"],
  // The logo that ships with the app (the full logo, and a tighter crop for the header). Both give way to
  // the logo uploaded in Admin → CMS → Home page, when there is one (see shopLogo in lib/cms.ts).
  logo: "/brand/trendz-logo.webp",
  emblem: "/brand/trendz-emblem.webp",
} as const;
