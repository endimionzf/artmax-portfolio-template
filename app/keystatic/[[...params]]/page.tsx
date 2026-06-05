'use client';

import { useEffect } from 'react';
import { makePage } from '@keystatic/next/ui/app';
import config from '../../../keystatic.config';

const KeystaticComponent = makePage(config);

export default function KeystaticPage() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path.length > 11 && path.endsWith('/')) {
      const cleanPath = path.slice(0, -1);
      window.history.replaceState(null, '', cleanPath + window.location.search);
    }
  }, []);

  return <KeystaticComponent />;
}
