import { ComingSoon } from '@/components/common/ComingSoon';
import { AdminLayout } from '@/components/layout/AdminLayout';

export default function SlaPage() {
  return (
    <AdminLayout>
      <ComingSoon
        title="SLA Мониторинг"
        description="Здесь будет отображаться статистика по соблюдению сроков ответов и решений."
      />
    </AdminLayout>
  );
}
