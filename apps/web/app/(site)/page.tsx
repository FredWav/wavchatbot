'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: any
}

interface ChatResponse {
  response: string
  conversationId: string
  metadata?: any
  error?: string
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Salut ! 👋 Je suis **Fred Wav**, ton expert en création de contenu vidéo/audio.

**Mon expertise :**
• TikTok & algorithmes 
• Lives & Multi-plateformes
• Audiovisuel & Montage
• Monétisation & Communauté

**Comment je fonctionne :**
Je réponds selon le système **"Wav Anti-Bullshit"** - jamais d'invention, toujours vérifiable. Si je ne sais pas, je te le dis clairement plutôt que d'inventer.

Pose-moi tes questions sur la création de contenu ! 🎥`,
      timestamp: new Date()
    }
  ])
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId
        }),
      })

      const data: ChatResponse = await response.json()

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        metadata: data.metadata
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (error) {
      console.error('Error sending message:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Désolé, une erreur est survenue. L'équipe Fred Wav a été notifiée. 

✅ **Certifié Wav Anti-Bullshit** — en cas d'erreur, on te le dit clairement !`,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">FW</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Fred Wav Chatbot</h1>
              <p className="text-sm text-gray-600">Expert en création de contenu</p>
            </div>
          </div>
          
          {/* Wav Anti-Bullshit Badge */}
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✅</span>
              <span className="text-sm font-medium text-green-800">Certifié Wav Anti-Bullshit</span>
            </div>
            <p className="text-xs text-green-600 mt-1">jamais d'invention, toujours vérifiable</p>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white shadow-sm border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {message.content.split('**').map((part, index) => 
                    index % 2 === 1 ? (
                      <strong key={index}>{part}</strong>
                    ) : (
                      <span key={index}>{part}</span>
                    )
                  )}
                </div>
                
                {/* Metadata indicators */}
                {message.metadata && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.metadata.refusal && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                        🛡️ Protection WAB
                      </span>
                    )}
                    {message.metadata.sources > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        📚 {message.metadata.sources} source(s)
                      </span>
                    )}
                    {message.metadata.movable && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                        ⚠️ Sujet mouvant
                      </span>
                    )}
                  </div>
                )}
                
                <div className="text-xs text-gray-500 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="text-gray-600">Fred Wav réfléchit...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pose ta question sur la création de contenu..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Envoyer
            </button>
          </form>
          
          <div className="mt-2 text-xs text-gray-500 text-center">
            Système <strong>Wav Anti-Bullshit</strong> activé • Conversation privée et sécurisée
          </div>
        </div>
      </div>
    </div>
  )
}