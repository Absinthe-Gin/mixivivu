export const ASSISTANT_ROUTES = {
  home: '/tro-ly',
  conversation: (id: string) => `/tro-ly/${encodeURIComponent(id)}`,
  settings: '/tro-ly/cai-dat',
} as const;
