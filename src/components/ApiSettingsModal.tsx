'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Trash2 } from 'lucide-react';
import { getApiSettings, saveApiSettings } from '@/lib/storage';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3.5-flash-lite');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const settings = getApiSettings();
      setApiKey(settings.apiKey || '');
      setModel(settings.preferredModel || 'gemini-3.5-flash-lite');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveApiSettings({
      apiKey,
      preferredModel: model,
    });
    onSaved();
    onClose();
  };

  const handleClear = () => {
    setApiKey('');
    saveApiSettings({ apiKey: '', preferredModel: model });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg max-w-md w-full p-5 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#1E3A8A]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Backup Gemini API Key</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#64748B] hover:text-[#0F172A] rounded hover:bg-[#F1F5F9]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="py-4 space-y-3.5">
          <p className="text-xs text-[#475569] leading-relaxed">
            The default API key reached its rate limit or is unavailable. Enter an alternate Gemini API key to continue generating quizzes.
          </p>

          {/* Key Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-[#0F172A]">API Key</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#1E3A8A] hover:underline flex items-center gap-1"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... or AQ..."
                className="w-full text-xs font-mono px-3 py-2 pr-14 bg-[#FFFFFF] border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#1E3A8A]"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#475569] hover:text-[#0F172A] px-1.5 py-0.5 bg-[#F1F5F9] rounded border border-[#E2E8F0]"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Model Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 bg-[#FFFFFF] border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-hidden focus:border-[#1E3A8A]"
            >
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Fastest, High Throughput)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash (Latest)</option>
              <option value="gemini-3.5-flash">gemini-3.5-flash (Balanced)</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
          {apiKey ? (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#991B1B] hover:bg-[#FEF2F2] border border-[#EF4444] rounded-md"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#475569] hover:text-[#0F172A] bg-[#F1F5F9] border border-[#CBD5E1] rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172554] rounded-md"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
