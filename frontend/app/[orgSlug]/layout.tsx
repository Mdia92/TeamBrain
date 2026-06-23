import { OrgLayoutClient } from "@/components/org-layout-client";

export function generateStaticParams() {
  return [{ orgSlug: "app" }];
}

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  return <OrgLayoutClient orgSlug={params.orgSlug}>{children}</OrgLayoutClient>;
}
