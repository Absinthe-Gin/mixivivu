import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Loading } from '@/components/feedback/States';
import { MainLayout } from '@/layouts/MainLayout';
import { HomePage } from '@/pages/HomePage';

/** Lazy-load a named page export so every route gets its own chunk. */
function page<K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) {
  const Component = lazy(async () => ({ default: (await loader())[name] as ComponentType }));
  return (
    <Suspense fallback={<Loading className="min-h-[60vh]" />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter(
  [
    // Full-screen assistant app (own layout, no site header/footer).
    { path: 'tro-ly', element: page(() => import('@/features/assistant/pages/AssistantPage'), 'AssistantPage') },
    { path: 'tro-ly/cai-dat', element: page(() => import('@/features/assistant/pages/AssistantSettingsPage'), 'AssistantSettingsPage') },
    { path: 'tro-ly/:conversationId', element: page(() => import('@/features/assistant/pages/AssistantPage'), 'AssistantPage') },
    {
      element: <MainLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'tim-du-thuyen', element: page(() => import('@/pages/ShipSearchPage'), 'ShipSearchPage') },
        { path: 'du-thuyen/:slug', element: page(() => import('@/pages/ShipDetailPage'), 'ShipDetailPage') },
        { path: 'khach-san', element: page(() => import('@/pages/HotelHomePage'), 'HotelHomePage') },
        { path: 'tim-khach-san', element: page(() => import('@/pages/HotelSearchPage'), 'HotelSearchPage') },
        { path: 'tim-khach-san/:slug', element: page(() => import('@/pages/HotelDetailPage'), 'HotelDetailPage') },
        { path: 'tim-ve-may-bay', element: page(() => import('@/pages/FlightPage'), 'FlightPage') },
        { path: 'tim-ve-may-bay/ket-qua', element: page(() => import('@/pages/FlightResultPage'), 'FlightResultPage') },
        { path: 'tim-ve-may-bay/ve-re-nhat-thang', element: page(() => import('@/pages/FlightResultPage'), 'FlightResultPage') },
        { path: 'doanh-nghiep', element: page(() => import('@/pages/BusinessPage'), 'BusinessPage') },
        { path: 'blog', element: page(() => import('@/pages/BlogPage'), 'BlogPage') },
        { path: 'blog-detail/:slug', element: page(() => import('@/pages/BlogDetailPage'), 'BlogDetailPage') },
        { path: 've-chung-toi', element: page(() => import('@/pages/AboutPage'), 'AboutPage') },
        { path: 'lien-he', element: page(() => import('@/pages/ContactPage'), 'ContactPage') },
        { path: 'cau-hoi-thuong-gap', element: page(() => import('@/pages/FaqPage'), 'ShipFaqPage') },
        { path: 'khach-san/cau-hoi-thuong-gap', element: page(() => import('@/pages/FaqPage'), 'HotelFaqPage') },
        { path: 'quy-dinh-chung-va-luu-y', element: page(() => import('@/pages/StaticContentPage'), 'ShipRulesPage') },
        { path: 'khach-san/quy-dinh-chung-va-luu-y', element: page(() => import('@/pages/StaticContentPage'), 'HotelRulesPage') },
        { path: 'dieu-khoan-va-dieu-kien', element: page(() => import('@/pages/StaticContentPage'), 'TermsPage') },
        { path: 'chinh-sach-rieng-tu', element: page(() => import('@/pages/StaticContentPage'), 'PrivacyPage') },
        { path: 'huong-dan-su-dung', element: page(() => import('@/pages/StaticContentPage'), 'GuidePage') },
        { path: 'hinh-thuc-thanh-toan', element: page(() => import('@/pages/StaticContentPage'), 'PaymentPage') },
        { path: '*', element: page(() => import('@/pages/NotFoundPage'), 'NotFoundPage') },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') },
);
