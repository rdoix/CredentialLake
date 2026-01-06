import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import AuthWrapper from "@/components/AuthWrapper";
import { ThemeProvider } from "@/contexts/ThemeContext";


export const metadata: Metadata = {
  title: "Credential Lake — Credential Leak Monitor",
  description: "Credential Lake platform for leak detection and validation. Built by Rdoix.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body
        className={`antialiased`}
      >
        <ThemeProvider>
          <UserProvider>
            <ToastProvider>
              <ConfirmProvider>
                <AuthWrapper>
                  {children}
                </AuthWrapper>
              </ConfirmProvider>
            </ToastProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
