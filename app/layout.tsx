import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mimamori - Watching over your health, every single day",
  description: "Intelligent patient advocacy platform for chronic condition management. Log symptoms with voice, get AI-synthesized health data, and create doctor-ready reports.",
  icons: {
    icon: [
      { url: '/images/mimamori_logo1.png', type: 'image/png' },
    ],
    apple: '/images/mimamori_logo1.png'
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import SmoothScroll from "@/components/SmoothScroll";
import { AppProvider } from "@/context/AppContext";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <AppProvider>
            <SmoothScroll>
              {children}
            </SmoothScroll>
          </AppProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
