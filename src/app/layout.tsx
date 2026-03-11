import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Content Publish Inspector',
  description: 'Inspect and verify content publishing across authoring, preview, live, and rendered website.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
