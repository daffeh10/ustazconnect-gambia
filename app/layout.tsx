import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from '@/app/components/AuthProvider'

export const metadata: Metadata = {
  title: "TutorConnect Gambia — Find Qualified Tutors Near You",
  description:
    "The Gambia's #1 platform for finding qualified in-person tutors. Browse by subject, location, and price. Book and pay securely with mobile money.",
  verification: {
    google: "6g7oSE7QXZmdFaiOLNNq4ZVEoh2ez9SLce46rVkLt_k",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
