import { LegalPage, legalPageMetadata } from "@/components/store/legal-page";

export const generateMetadata = () => legalPageMetadata("terms");

export default function TermsPage() {
  return <LegalPage slug="terms" />;
}
