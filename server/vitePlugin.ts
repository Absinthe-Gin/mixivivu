import type { Connect, Plugin } from 'vite';
import { handleChat } from './chatHandler.ts';

/** Serves POST {base}api/chat from the Vite dev and preview servers. */
export function chatApiPlugin(base: string): Plugin {
  const path = `${base}api/chat`;
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.split('?')[0] !== path) return next();
    handleChat(req, res).catch(next);
  };
  return {
    name: 'mixivivu-chat-api',
    configureServer: (server) => {
      server.middlewares.use(middleware);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(middleware);
    },
  };
}
