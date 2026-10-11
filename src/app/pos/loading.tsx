import { Spinner } from "@/components/ui";

/** Shown while the billing screen's code and data arrive. */
export default function PosLoading() {
  return <Spinner className="min-h-screen" label="Loading the billing screen" />;
}
