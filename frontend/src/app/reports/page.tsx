import { ComingSoon } from '@/components/common/ComingSoon';
import { AdminLayout } from '@/components/layout/AdminLayout';

export default function ReportsPage() {
  return (
    <AdminLayout>
      <ComingSoon
        title="Отчеты"
        description="Здесь будут доступны детальные отчеты по активности, качеству работы и другим метрикам."
      />
    </AdminLayout>
  );
}
