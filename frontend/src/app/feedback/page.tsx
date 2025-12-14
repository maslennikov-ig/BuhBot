import type { Metadata } from 'next';
import { FeedbackContent } from './feedback-content';

export const metadata: Metadata = {
  title: 'Обратная связь | BuhBot',
  description: 'Анализ отзывов клиентов и индекс лояльности NPS',
};

export default function FeedbackPage() {
  return <FeedbackContent />;
}
