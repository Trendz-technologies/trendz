"use client";

import { PageHeader } from "@/components/admin/page";
import { ProductForm } from "@/components/admin/catalog-product-form";
import { EmptyState } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function NewProductPage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader title="New product" description="Images and codes can be added once the product is created." back={{ href: "/admin/products", label: "Products" }} />
      {can("products.write") ? <ProductForm /> : <EmptyState title="You don't have permission to create products" body="Ask an administrator for the products.write permission." />}
    </>
  );
}
