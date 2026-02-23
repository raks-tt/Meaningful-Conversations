import React, { useState, useEffect } from 'react';
import * as userService from '../services/userService';
import { NewsletterSubscriber, NewsletterHistoryEntry } from '../services/userService';
import { apiFetch } from '../services/api';
import Spinner from './shared/Spinner';
import { MailIcon } from './icons/MailIcon';
import { ClockIcon } from './icons/ClockIcon';
import { useLocalization } from '../context/LocalizationContext';

const NewsletterPanel: React.FC = () => {
  const { language, t } = useLocalization();
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [history, setHistory] = useState<NewsletterHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showSubscribers, setShowSubscribers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Primary language is the current UI language, secondary is the other
  const primaryLang = language;
  const secondaryLang = language === 'de' ? 'en' : 'de';
  const primaryFlag = language === 'de' ? '🇩🇪' : '🇬🇧';
  const secondaryFlag = language === 'de' ? '🇬🇧' : '🇩🇪';

  // State for primary and secondary content
  const [subjectPrimary, setSubjectPrimary] = useState('');
  const [subjectSecondary, setSubjectSecondary] = useState('');
  const [textBodyPrimary, setTextBodyPrimary] = useState('');
  const [textBodySecondary, setTextBodySecondary] = useState('');

  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subscribersData, historyData] = await Promise.all([
        userService.getNewsletterSubscribers(),
        userService.getNewsletterHistory()
      ]);
      setSubscribers(subscribersData.subscribers);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load newsletter data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!subjectPrimary || !subjectSecondary || !textBodyPrimary || !textBodySecondary) {
      setResult({ type: 'error', message: t('newsletter_fill_all_fields') });
      return;
    }

    if (!window.confirm(t('newsletter_confirm_send', { count: subscribers.length }))) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      // Map primary/secondary back to DE/EN for the backend
      const content = {
        subjectDE: primaryLang === 'de' ? subjectPrimary : subjectSecondary,
        subjectEN: primaryLang === 'en' ? subjectPrimary : subjectSecondary,
        textBodyDE: primaryLang === 'de' ? textBodyPrimary : textBodySecondary,
        textBodyEN: primaryLang === 'en' ? textBodyPrimary : textBodySecondary,
      };

      const response = await userService.sendNewsletter(content);

      let message = t('newsletter_send_success', { sent: response.sent, total: response.total });
      if (response.failed > 0) {
        message += ` (${t('newsletter_send_failed', { failed: response.failed })})`;
      }

      setResult({ type: 'success', message });

      // Clear fields after successful send
      setSubjectPrimary('');
      setSubjectSecondary('');
      setTextBodyPrimary('');
      setTextBodySecondary('');

      // Reload history
      const historyData = await userService.getNewsletterHistory();
      setHistory(historyData);

    } catch (error: any) {
      setResult({
        type: 'error',
        message: error.message || t('newsletter_send_error')
      });
    } finally {
      setSending(false);
    }
  };

  const handleTranslate = async () => {
    if (!subjectPrimary && !textBodyPrimary) {
      setResult({ type: 'error', message: t('newsletter_fill_all_fields') });
      return;
    }

    setTranslating(true);
    setResult(null);

    try {
      const data = await apiFetch('/gemini/translate', {
        method: 'POST',
        body: JSON.stringify({
          subject: subjectPrimary || undefined,
          body: textBodyPrimary || undefined,
          sourceLang: primaryLang,
          targetLang: secondaryLang
        })
      });

      if (data.subject) {
        setSubjectSecondary(data.subject);
      }
      if (data.body) {
        setTextBodySecondary(data.body);
      }

      setResult({
        type: 'success',
        message: t('newsletter_translate_success')
      });

    } catch (error: any) {
      setResult({
        type: 'error',
        message: error.message || t('newsletter_translate_error')
      });
    } finally {
      setTranslating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-background-secondary dark:bg-background-primary rounded-lg">
        <div className="flex items-center justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 p-6 bg-background-secondary dark:bg-background-primary rounded-lg border border-border-secondary dark:border-border-primary">
      <div className="flex items-center gap-3 mb-4">
        <MailIcon className="w-6 h-6 text-accent-primary" />
        <div>
          <h3 className="text-xl font-bold text-content-primary">{t('newsletter_panel_title')}</h3>
          <p className="text-sm text-content-secondary">
            {t('newsletter_subscribers_count', { count: subscribers.length })}
          </p>
        </div>
      </div>

      {/* Subscriber List Toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowSubscribers(!showSubscribers)}
          className="text-sm text-accent-primary hover:underline"
        >
          {showSubscribers ? '▼' : '▶'} {t('newsletter_show_subscribers')} ({subscribers.length})
        </button>

        {showSubscribers && (
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto bg-background-tertiary dark:bg-background-secondary p-3 rounded border border-border-secondary">
            {subscribers.length === 0 ? (
              <p className="text-sm text-content-secondary italic">{t('newsletter_no_subscribers_found')}</p>
            ) : (
              subscribers.map(sub => (
                <div key={sub.id} className="text-xs text-content-secondary p-2 bg-background-secondary dark:bg-background-primary rounded flex items-center justify-between">
                  <div>
                    <span className="font-mono">{sub.email}</span>
                    {(sub.firstName || sub.lastName) && (
                      <span className="ml-2 text-content-tertiary">
                        ({sub.firstName || ''} {sub.lastName || ''})
                      </span>
                    )}
                  </div>
                  {(sub as any).status === 'PENDING' && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 rounded text-[10px] font-medium">
                      PENDING
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {subscribers.length === 0 ? (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-sm text-content-secondary">
          {t('newsletter_no_subscribers_warning')}
        </div>
      ) : (
        <>
          {/* Primary Language Version */}
          <div className="space-y-3 mb-4 p-4 border border-border-secondary rounded-lg bg-background-tertiary dark:bg-background-secondary">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{primaryFlag}</span>
                <h4 className="font-bold text-content-primary">{t('newsletter_primary_version')}</h4>
              </div>
              <button
                onClick={handleTranslate}
                disabled={translating || sending || (!subjectPrimary && !textBodyPrimary)}
                className="px-4 py-2 bg-content-tertiary/20 dark:bg-content-tertiary/10 text-content-primary hover:bg-content-tertiary/30 dark:hover:bg-content-tertiary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold transition-colors rounded border border-border-secondary"
                title={t('newsletter_translate_button')}
              >
                {translating ? (
                  <>
                    <Spinner />
                    <span className="hidden sm:inline">{t('newsletter_translating')}</span>
                  </>
                ) : (
                  <>
                    <span>🌐</span>
                    <span className="hidden sm:inline">{t('newsletter_translate_button')}</span>
                  </>
                )}
              </button>
            </div>
            <div>
              <label htmlFor="subject-primary" className="block text-sm font-semibold text-content-secondary mb-1">
                {t('newsletter_subject_label')}
              </label>
              <input
                id="subject-primary"
                type="text"
                placeholder={t(`newsletter_subject_placeholder_${primaryLang}`)}
                value={subjectPrimary}
                onChange={(e) => setSubjectPrimary(e.target.value)}
                className="w-full p-2 border border-border-secondary rounded bg-background-primary text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none"
                disabled={sending}
              />
            </div>
            <div>
              <label htmlFor="body-primary" className="block text-sm font-semibold text-content-secondary mb-1">
                {t('newsletter_body_label')}
              </label>
              <textarea
                id="body-primary"
                placeholder={t(`newsletter_body_placeholder_${primaryLang}`)}
                value={textBodyPrimary}
                onChange={(e) => setTextBodyPrimary(e.target.value)}
                rows={8}
                className="w-full p-2 border border-border-secondary rounded bg-background-primary text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none font-mono text-sm"
                disabled={sending}
              />
              <p className="text-xs text-content-tertiary mt-1">
                {t('newsletter_markdown_hint')}
              </p>
            </div>
          </div>

          {/* Secondary Language Version */}
          <div className="space-y-3 mb-4 p-4 border border-border-secondary rounded-lg bg-background-tertiary dark:bg-background-secondary">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{secondaryFlag}</span>
              <h4 className="font-bold text-content-primary">{t('newsletter_secondary_version')}</h4>
            </div>
            <div>
              <label htmlFor="subject-secondary" className="block text-sm font-semibold text-content-secondary mb-1">
                {t('newsletter_subject_label')}
              </label>
              <input
                id="subject-secondary"
                type="text"
                placeholder={t(`newsletter_subject_placeholder_${secondaryLang}`)}
                value={subjectSecondary}
                onChange={(e) => setSubjectSecondary(e.target.value)}
                className="w-full p-2 border border-border-secondary rounded bg-background-primary text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none"
                disabled={sending}
              />
            </div>
            <div>
              <label htmlFor="body-secondary" className="block text-sm font-semibold text-content-secondary mb-1">
                {t('newsletter_body_label')}
              </label>
              <textarea
                id="body-secondary"
                placeholder={t(`newsletter_body_placeholder_${secondaryLang}`)}
                value={textBodySecondary}
                onChange={(e) => setTextBodySecondary(e.target.value)}
                rows={8}
                className="w-full p-2 border border-border-secondary rounded bg-background-primary text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none font-mono text-sm"
                disabled={sending}
              />
              <p className="text-xs text-content-tertiary mt-1">
                {t('newsletter_markdown_hint')}
              </p>
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div className={`p-3 rounded mb-4 ${result.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700'}`}>
              {result.message}
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending || !subjectPrimary || !subjectSecondary || !textBodyPrimary || !textBodySecondary}
            className="w-full px-6 py-3 bg-accent-primary text-button-foreground-on-accent font-bold rounded-lg hover:bg-accent-primary-hover disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            {sending ? (
              <>
                <Spinner />
                <span>{t('newsletter_sending')}</span>
              </>
            ) : (
              <>
                <MailIcon className="w-5 h-5" />
                <span>{t('newsletter_send_button', { count: subscribers.length })}</span>
              </>
            )}
          </button>

          {/* Info Box */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded text-sm text-content-secondary">
            <p className="font-semibold mb-1">ℹ️ {t('newsletter_info_title')}</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>✨ <strong>{t('newsletter_info_markdown')}</strong></li>
              <li>{t('newsletter_info_active_only')}</li>
              <li>{t('newsletter_info_language')}</li>
              <li>{t('newsletter_info_unsubscribe')}</li>
              <li>{t('newsletter_info_rate_limit')}</li>
              <li>{t('newsletter_info_dev_simulation')}</li>
            </ul>
          </div>
        </>
      )}

      {/* Newsletter History */}
      <div className="mt-6 p-4 bg-background-tertiary dark:bg-background-secondary rounded-lg border border-border-secondary">
        <div className="flex items-center gap-2 mb-3">
          <ClockIcon className="w-5 h-5 text-accent-primary" />
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm font-semibold text-content-primary hover:text-accent-primary"
          >
            {showHistory ? '▼' : '▶'} {t('newsletter_history_title')} ({history.length})
          </button>
        </div>

        {showHistory && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-sm text-content-secondary italic">{t('newsletter_history_empty')}</p>
            ) : (
              history.map(entry => (
                <div key={entry.id} className="p-3 bg-background-primary dark:bg-background-tertiary rounded border border-border-secondary">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-content-primary">
                        🇩🇪 {entry.subjectDE} / 🇬🇧 {entry.subjectEN}
                      </p>
                      <p className="text-xs text-content-secondary mt-1">
                        {t('newsletter_history_sent_by')}: {entry.sentByEmail}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-content-tertiary">
                        {new Date(entry.createdAt).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs mt-2">
                    <span className="text-green-600 dark:text-green-400">
                      ✓ {entry.successCount} {t('newsletter_history_successful')}
                    </span>
                    {entry.failedCount > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        ✗ {entry.failedCount} {t('newsletter_history_failed')}
                      </span>
                    )}
                    <span className="text-content-tertiary">
                      {t('newsletter_history_of_recipients', { count: entry.recipientCount })}
                    </span>
                  </div>

                  {entry.errors && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
                        {t('newsletter_history_show_errors')}
                      </summary>
                      <pre className="text-xs mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded overflow-x-auto">
                        {JSON.stringify(entry.errors, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsletterPanel;
