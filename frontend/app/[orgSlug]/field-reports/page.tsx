"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Legacy route — field reports live under Documents. */
export default function FieldReportsRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  useEffect(() => {
    router.replace(`/${orgSlug}/documents?tab=field_report`);
  }, [router, orgSlug]);

  return null;
}
