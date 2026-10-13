import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Task Tracking App',
  description: 'Screenshot tracking for Task Tracking App',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
