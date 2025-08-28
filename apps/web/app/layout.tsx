import './globals.css'

export const metadata = {
  title: 'Fred Wav Chatbot - Expert en Création de Contenu',
  description: 'Chat avec Fred Wav, expert en TikTok, Lives, Audiovisuel et Monétisation. Système Wav Anti-Bullshit pour des conseils vérifiables.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}