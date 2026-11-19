import type { Connect, Plugin } from 'vite';
import { type Api, createApi } from './api.ts';

/** Serves {base}api/* (auth + assistant) from the Vite dev and preview servers. */
export function apiPlugin(base: string): Plugin {
  // Created on first request so loading the Vite config never opens the database.
  let api: Api | null = null;
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith(`${base}api/`)) return next();
    api ??= createApi({ basePath: base });
    api.handle(req, res).then((handled) => handled || next(), next);
  };
  return {
    name: 'mixivivu-api',
    configureServer: (server) => {
      server.middlewares.use(middleware);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(middleware);
    },
  };
}
