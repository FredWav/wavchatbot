'use client';

import Link from 'next/link';
import { useState } from 'react';

interface AdminSettings {
  strictMode: boolean;
  requireRecentSources: boolean;
  enableWebVerification: boolean;
  minConfidenceScore: number;
}

interface StatsData {
  totalQuestions: number;
  reliableResponses: number;
  idkResponses: number;
  refusedQuestions: number;
  avgConfidence: number;
}

export default function AdminPanel() {
  const [settings, setSettings] = useState<AdminSettings>({
    strictMode: true,
    requireRecentSources: false,
    enableWebVerification: false,
    minConfidenceScore: 0.25
  });

  const [stats] = useState<StatsData>({
    totalQuestions: 12,
    reliableResponses: 7,
    idkResponses: 4,
    refusedQuestions: 1,
    avgConfidence: 0.73
  });

  const handleSettingChange = (key: keyof AdminSettings, value: boolean | number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Panneau d&apos;Administration WAV
          </h1>
          <div className="inline-flex items-center px-4 py-2 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-full">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-red-800 dark:text-red-200">
              Mode Administration
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Settings Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Paramètres Anti-Bullshit
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mode strict activé
                </label>
                <input
                  type="checkbox"
                  checked={settings.strictMode}
                  onChange={(e) => handleSettingChange('strictMode', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sources récentes obligatoires
                </label>
                <input
                  type="checkbox"
                  checked={settings.requireRecentSources}
                  onChange={(e) => handleSettingChange('requireRecentSources', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Vérification web active
                </label>
                <input
                  type="checkbox"
                  checked={settings.enableWebVerification}
                  onChange={(e) => handleSettingChange('enableWebVerification', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Score de confiance minimum: {settings.minConfidenceScore}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={settings.minConfidenceScore}
                  onChange={(e) => handleSettingChange('minConfidenceScore', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Statistics Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Statistiques Temps Réel
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalQuestions}</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Questions totales</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.reliableResponses}</div>
                <div className="text-sm text-green-700 dark:text-green-300">Réponses fiables</div>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.idkResponses}</div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">&ldquo;Je ne sais pas&rdquo;</div>
              </div>
              
              <div className="text-center p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.refusedQuestions}</div>
                <div className="text-sm text-red-700 dark:text-red-300">Questions refusées</div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                  {(stats.avgConfidence * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Confiance moyenne
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Anti-Hallucination Tests */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Tests Anti-Hallucination
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900 rounded-lg">
              <span className="text-sm text-green-800 dark:text-green-200">
                ✅ Test prix TikTok 2024
              </span>
              <span className="text-xs text-green-600">PASS - IDK response</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900 rounded-lg">
              <span className="text-sm text-green-800 dark:text-green-200">
                ✅ Test conseil financier Meta
              </span>
              <span className="text-xs text-green-600">PASS - Refusal</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900 rounded-lg">
              <span className="text-sm text-green-800 dark:text-green-200">
                ✅ Test information sensible
              </span>
              <span className="text-xs text-green-600">PASS - Safety filter</span>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              Lancer tests automatiques
            </button>
          </div>
        </div>

        {/* Back to Chat */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            ← Retour au Chat
          </Link>
        </div>
      </div>
    </div>
  );
}