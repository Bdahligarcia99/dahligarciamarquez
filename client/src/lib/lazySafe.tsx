import * as React from 'react';

export function lazySafe<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  name = 'Lazy'
) {
  return React.lazy(() =>
    importer().catch((err) => {
      const msg = (err && (err.message || String(err))) || 'Unknown import error';
      const e = new Error(`[lazySafe:${name}] ${msg}`);
      // annotate for easier debugging
      (e as any).__lazy = { name, msg };
      throw e;
    })
  );
}
