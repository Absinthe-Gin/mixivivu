import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter(
  [{ path: '*', element: <div className="container-page py-20">Mixivivu clone</div> }],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') },
);
