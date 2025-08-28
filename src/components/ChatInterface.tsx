'use client';

import { useState } from 'react';
import { shouldRefuseAnswer, getRandomIdkResponse } from '@/lib/anti-bullshit';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  refused?: boolean;
  reason?: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Bonjour ! Je suis l'assistant WAV certifié Anti-Bullshit. Je préfère dire 'Je ne sais pas' plutôt que d'inventer des informations. Comment puis-je vous aider ?",
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Check anti-bullshit rules first
      const refusalCheck = shouldRefuseAnswer(input);
      
      if (refusalCheck.refuse) {
        const refusalMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: refusalCheck.response || getRandomIdkResponse(),
          role: 'assistant',
          timestamp: new Date(),
          refused: true,
          reason: refusalCheck.reason
        };
        
        setMessages(prev => [...prev, refusalMessage]);
        setIsLoading(false);
        return;
      }

      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || getRandomIdkResponse(),
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Je ne sais pas - une erreur technique s'est produite. Veuillez réessayer.",
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        {/* Chat Messages */}
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.refused
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                {message.refused && (
                  <div className="mt-2 text-xs opacity-75">
                    🛡️ Réponse filtrée par le système Anti-Bullshit
                  </div>
                )}
                <div className="text-xs opacity-50 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-600 p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Envoyer
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            🛡️ Système Anti-Bullshit actif - Réponses vérifiées
          </div>
        </form>
      </div>

      {/* Stats Panel */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Statistiques Anti-Bullshit
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {messages.filter(m => m.role === 'assistant' && !m.refused).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Réponses fiables
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {messages.filter(m => m.refused).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              &ldquo;Je ne sais pas&rdquo;
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {messages.filter(m => m.role === 'user').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Questions posées
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}