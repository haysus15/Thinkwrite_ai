'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import styles from './MirrorModeDashboard.module.css';

type BridgeStudio = 'academic' | 'career';

export interface BridgeReflectionCardProps {
  session: {
    id: string;
    studio: BridgeStudio;
    sourceLanguage: string;
    createdAt: string;
    reflectionViewed: boolean;
    ursieReflection: string | null;
  };
  onMarkReviewed: (sessionId: string) => void;
  onOpenUrsie: (sessionId: string) => void;
}

function truncateReflection(text: string): string {
  const sentences = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const preview = sentences.slice(0, 2).join(' ');
  if (!preview) return text;
  return preview.length < text.trim().length ? `${preview}…` : preview;
}

function getRelativeTimeLabel(
  createdAt: string,
  t: ReturnType<typeof useTranslations>
): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return t('mirror.bridgeMode.cards.time.justNow');
  }

  const diffMs = Date.now() - created.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return t('mirror.bridgeMode.cards.time.justNow');
  if (diffMinutes < 60) {
    return diffMinutes === 1
      ? t('mirror.bridgeMode.cards.time.oneMinuteAgo')
      : t('mirror.bridgeMode.cards.time.minutesAgo', { count: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1
      ? t('mirror.bridgeMode.cards.time.oneHourAgo')
      : t('mirror.bridgeMode.cards.time.hoursAgo', { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return t('mirror.bridgeMode.cards.time.yesterday');
  return t('mirror.bridgeMode.cards.time.daysAgo', { count: diffDays });
}

export default function BridgeReflectionCard({
  session,
  onMarkReviewed,
  onOpenUrsie,
}: BridgeReflectionCardProps) {
  const t = useTranslations();

  const preview = useMemo(() => {
    if (!session.ursieReflection) return null;
    return truncateReflection(session.ursieReflection);
  }, [session.ursieReflection]);

  if (!preview) {
    return null;
  }

  return (
    <article
      className={`${styles.bridgeReflectionCard} ${
        !session.reflectionViewed ? styles.bridgeReflectionCardUnread : ''
      }`}
    >
      <div className={styles.bridgeReflectionMeta}>
        <span>{t(`mirror.bridgeMode.cards.studios.${session.studio}`)}</span>
        <span>{getRelativeTimeLabel(session.createdAt, t)}</span>
      </div>
      <p className={styles.bridgeReflectionText}>{preview}</p>
      <div className={styles.bridgeReflectionFooter}>
        <button
          type="button"
          className={styles.bridgeReflectionLink}
          onClick={() => onOpenUrsie(session.id)}
        >
          {t('mirror.bridgeMode.cards.readMore')}
        </button>
        <button
          type="button"
          className={styles.bridgeReflectionAction}
          onClick={() => onMarkReviewed(session.id)}
        >
          {t('mirror.bridgeMode.cards.markReviewed')}
        </button>
      </div>
    </article>
  );
}
