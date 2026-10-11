import { BRAND } from "./brand";
import type { Locale, Message } from "./i18n";
import { ta } from "./i18n/ta";
import type { ContactDetails, HomePageContent, LocalizedText, StoreConfig } from "./types";

/**
 * Storefront content written under Admin → CMS (home page sections, contact
 * details, legal pages): how it is read, and what the storefront shows when
 * the API cannot supply it.
 */

/** Text written in the admin, in the shopper's language; an empty language falls back to the other. */
export const localize = (locale: Locale) => (text: LocalizedText) => (locale === "ta" ? text.ta || text.en : text.en || text.ta);

/** The lines of an address or of opening hours (typed one per line). */
export const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** A stored Indian mobile number as people read it: "+919360734597" → "+91 93607 34597". Anything else is shown as it was typed. */
export const displayPhone = (phone: string) => phone.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");
export const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
export const whatsappHref = (number: string) => `https://wa.me/${number.replace(/\D/g, "")}`;
export const instagramHref = (handle: string) => `https://www.instagram.com/${handle}/`;

// English with the Tamil the storefront dictionary has for the same sentence.
const bilingual = (en: Message): LocalizedText => ({ en, ta: ta[en] });

/*
 * What the home page says when the API does not send its content: it cannot be
 * reached, or it is an older build than this app. The same text as the API's
 * own defaults (src/modules/settings/cms.ts in trendz-api), so the page reads the
 * same either way.
 */
const DEFAULT_HOME_PAGE: HomePageContent = {
  logo: { imageKey: null, imageUrl: null },
  hero: {
    titleTop: bilingual("Luxury in"),
    titleBottom: bilingual("Every Stitch."),
    tagline: bilingual("Fashion for every you"),
    body: bilingual("Kurti sets, anarkalis, lehengas, party wear and more — thoughtfully chosen pieces for every celebration and every day."),
    primaryLabel: bilingual("Explore collection"),
    primaryHref: "/products",
    secondaryLabel: bilingual("See today's offers"),
    secondaryHref: "/offers",
    highlightValue: bilingual("Weekly"),
    highlightLabel: bilingual("New arrivals"),
    imageKey: null,
    imageUrl: null,
  },
  categories: { enabled: true, eyebrow: bilingual("Collections"), title: bilingual("Shop by category"), linkLabel: bilingual("Browse everything") },
  popular: { enabled: true, eyebrow: bilingual("Most loved"), title: bilingual("Popular picks"), linkLabel: bilingual("View all") },
  editorial: {
    enabled: true,
    eyebrow: bilingual("The Trendz edit"),
    title: bilingual("Made for every occasion."),
    titleAccent: bilingual("Styled your way."),
    body: bilingual("Graceful silhouettes, rich fabrics and colours that flatter — so every piece you pick feels special, whether it is a festival, a function or an ordinary day."),
    points: [bilingual("Festive edits"), bilingual("Everyday elegance"), bilingual("Perfect fits")],
  },
  promises: {
    enabled: true,
    shippingBody: bilingual("Every order ships with live tracking updates by SMS and email."),
    returnsBody: bilingual("Changed your mind? Request a return from your account in a few taps."),
    paymentTitle: bilingual("Secure checkout"),
    paymentBody: bilingual("Pay with UPI, cards or netbanking through Razorpay."),
  },
  newArrivals: { enabled: true, eyebrow: bilingual("Just landed"), title: bilingual("New arrivals"), linkLabel: bilingual("Shop new") },
  closing: { enabled: true, title: bilingual("Find the outfit that feels like you."), buttonLabel: bilingual("Shop the collection"), buttonHref: "/products", whatsappLabel: bilingual("Chat on WhatsApp") },
};

/** The same for the contact details: the facts on the shop's own banner. */
const DEFAULT_CONTACT: ContactDetails = {
  eyebrow: bilingual("Get in touch"),
  // Written out: the heading is the full sentence, while the menus' "Contact us" is a short word in Tamil.
  title: { en: "Contact us", ta: "எங்களைத் தொடர்பு கொள்ளுங்கள்" },
  intro: bilingual("Questions about an order, a size or a style? Message us on WhatsApp, call the shop or visit us. We are happy to help."),
  phone: BRAND.phone,
  whatsapp: BRAND.phone,
  email: "",
  instagram: BRAND.instagram,
  address: { en: BRAND.address.join("\n"), ta: BRAND.address.map((line) => ta[line]).join("\n") },
  hours: { en: "", ta: "" },
  mapUrl: "",
};

export const homeContent = (config: StoreConfig | null): HomePageContent => config?.home ?? DEFAULT_HOME_PAGE;
/**
 * The logo uploaded in Admin → CMS → Home page, or null to show the one that ships with the app.
 * A store config cached before the logo could be uploaded has no `logo` at all, hence the careful reading.
 */
export const shopLogo = (config: StoreConfig | null): string | null => (config?.home as Partial<HomePageContent> | undefined)?.logo?.imageUrl ?? null;
export const contactDetails = (config: StoreConfig | null): ContactDetails => config?.contact ?? DEFAULT_CONTACT;
