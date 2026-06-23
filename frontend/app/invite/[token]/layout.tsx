export function generateStaticParams() {
  return [{ token: "_" }];
}

export default function InviteTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
