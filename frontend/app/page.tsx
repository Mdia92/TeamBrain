"use client";

import { useAuth } from "@/app/contexts/AuthContext";
import { LandingPage } from "@/components/landing/landing-page";

export default function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A]" aria-busy="true" aria-label="Chargement" />
    );
  }

  return <LandingPage user={user} />;
}
