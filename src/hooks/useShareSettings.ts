import { useEffect, useState } from 'react';

export interface ShareSettings {
  gameName: string;
}

const STORAGE_KEY = 'kniffel-extreme-share-settings';
const defaultSettings: ShareSettings = {
  gameName: 'Kniffel Extreme (Sniper)',
};

const loadInitialSettings = (): ShareSettings => {
  if (typeof window === 'undefined') {
    return { ...defaultSettings };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return { ...defaultSettings };
    }

    const parsed = JSON.parse(saved);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        ...defaultSettings,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn('Failed to parse share settings:', error);
  }

  return { ...defaultSettings };
};

export const useShareSettings = () => {
  const [shareSettings, setShareSettings] = useState<ShareSettings>(() => loadInitialSettings());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shareSettings));
    } catch (error) {
      console.warn('Failed to persist share settings:', error);
    }
  }, [shareSettings]);

  const updateShareSettings = (updates: Partial<ShareSettings>) => {
    setShareSettings((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const resetShareSettings = () => {
    setShareSettings({ ...defaultSettings });
  };

  return {
    shareSettings,
    updateShareSettings,
    resetShareSettings,
  };
};
