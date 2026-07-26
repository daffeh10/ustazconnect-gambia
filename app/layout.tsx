import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from '@/app/components/AuthProvider'

export const metadata: Metadata = {
  title: "TutorConnect Gambia — Find Tutors In Person or Online",
  description:
    "Compare tutors by subject, area, price, availability, and review level. Find in-person tutors across The Gambia and online Quran teachers for Gambians abroad.",
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
