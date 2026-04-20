import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeedbackDetailsContent } from './feedback-details-content';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: 'Детали отзыва | BuhBot',
    description: `Просмотр отзыва ${id}`,
  };
}

export default async function FeedbackDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    notFound();
  }

  return <FeedbackDetailsContent feedbackId={id} />;
}
