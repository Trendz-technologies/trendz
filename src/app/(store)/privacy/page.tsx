import { LegalPage, legalPageMetadata } from "@/components/store/legal-page";

export const generateMetadata = () => legalPageMetadata("privacy");

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />;
}
