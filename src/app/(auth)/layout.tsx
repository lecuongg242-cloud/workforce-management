export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <div className="min-h-dvh bg-white">{children}</div>;
}
