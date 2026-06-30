import { OrgLayoutClient } from "@/components/org-layout-client";
import { OrgSyncProvider } from "@/app/contexts/OrgSyncContext";

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
  return (
    <OrgSyncProvider>
      <OrgLayoutClient orgSlug={params.orgSlug}>{children}</OrgLayoutClient>
    </OrgSyncProvider>
  );
}
