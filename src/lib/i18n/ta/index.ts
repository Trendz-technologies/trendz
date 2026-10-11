import { account } from "./account";
import { auth } from "./auth";
import { checkout } from "./checkout";
import { common } from "./common";
import { reviews } from "./reviews";
import { shop } from "./shop";

/**
 * The Tamil dictionary: English sentence → Tamil sentence, split by area of
 * the storefront. `{name}` placeholders must be kept in the translation.
 * `npm run i18n:check` lists text used in the code that is missing here.
 */
export const ta = { ...shop, ...checkout, ...auth, ...account, ...reviews, ...common };
