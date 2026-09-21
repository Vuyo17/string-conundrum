import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getApiUrl } from '../config/api';
import { useLanguage } from './LanguageContext';
import { localiseModules } from '../utils/moduleCatalog';
import en from '../locales/en.json';

const ModuleCatalogContext = createContext(null);

export function ModuleCatalogProvider({ children }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/modules'));
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.modules)) {
        throw new Error('Could not load modules');
      }
      if (request === latestRequest.current) {
        setModules(data.modules);
        setError(null);
      }
    } catch (err) {
      if (request === latestRequest.current) setError(err);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      latestRequest.current += 1;
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const value = useMemo(() => ({ modules, loading, error, refresh }), [modules, loading, error, refresh]);
  return <ModuleCatalogContext.Provider value={value}>{children}</ModuleCatalogContext.Provider>;
}

export function useModuleCatalog() {
  const catalog = useContext(ModuleCatalogContext);
  const { t } = useLanguage();
  if (!catalog) throw new Error('useModuleCatalog must be inside ModuleCatalogProvider');
  return useMemo(() => ({
    ...catalog, modules: localiseModules(catalog.modules, t, en.modules.items),
  }), [catalog, t]);
}
