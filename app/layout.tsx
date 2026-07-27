import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from '@/app/components/AuthProvider'

export const metadata: Metadata = {
  title: "TutorConnect Gambia — Find Tutors Across The Gambia",
  description:
    "Compare tutors across The Gambia by subject, area, price, availability, and review level.",
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
