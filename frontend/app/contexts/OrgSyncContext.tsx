"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiClient } from "@/app/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";

type OrgSyncContextValue = {
  revision: number;
  bumpLocal: () => void;
};

const OrgSyncContext = createContext<OrgSyncContextValue>({ revision: 0, bumpLocal: () => {} });

export function OrgSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const lastRef = useRef(0);

  const poll = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiClient.get<{ revision: number }>("/api/activity/revision");
      if (data.revision > lastRef.current) {
        lastRef.current = data.revision;
        setRevision(data.revision);
        window.dispatchEvent(
          new CustomEvent("teambrain:org-changed", { detail: { revision: data.revision } }),
        );
      }
    } catch {
      /* offline or auth */
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void poll();
    const id = window.setInterval(() => void poll(), 12_000);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, poll]);

  const bumpLocal = useCallback(() => {
    lastRef.current += 1;
    setRevision((r) => r + 1);
    window.dispatchEvent(
      new CustomEvent("teambrain:org-changed", { detail: { revision: lastRef.current } }),
    );
  }, []);

  return (
    <OrgSyncContext.Provider value={{ revision, bumpLocal }}>
      {children}
    </OrgSyncContext.Provider>
  );
}

export function useOrgSync() {
  return useContext(OrgSyncContext);
}

export function useOrgRefresh(onRefresh: () => void) {
  useEffect(() => {
    const handler = () => onRefresh();
    window.addEventListener("teambrain:org-changed", handler);
    return () => window.removeEventListener("teambrain:org-changed", handler);
  }, [onRefresh]);
}
