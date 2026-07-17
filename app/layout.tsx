import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AmplifyProvider } from "@/components/auth/amplify-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToaster } from "@/components/theme-toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Ampere Studio",
    template: "%s | Ampere Studio",
  },
  description:
    "Ampere Studio is the command center for every Ampere client website. Manage products, review form submissions, and edit your live site from one place.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(geist.variable, fontMono.variable)}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AmplifyProvider>
          <ThemeProvider>
            <TooltipProvider>
              {children}
              <ThemeToaster />
            </TooltipProvider>
          </ThemeProvider>
        </AmplifyProvider>
      </body>
    </html>
  )
}
