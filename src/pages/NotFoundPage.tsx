import { ButtonLink } from '@/components/common/Button';
import { EmptyState } from '@/components/feedback/States';
import { ROUTES } from '@/constants/routes';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Không tìm thấy trang');
  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center px-4">
      <EmptyState
        title="404 - Không tìm thấy trang"
        description="Trang bạn tìm kiếm không tồn tại hoặc đã được di chuyển."
        action={<ButtonLink to={ROUTES.home}>Về trang chủ</ButtonLink>}
      />
    </div>
  );
}
