import React, { useState } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import * as userService from '../services/userService';
import { AIRegionPreference } from '../services/userService';
import { User } from '../types';
import Button from './shared/Button';

interface EditProfileViewProps {
  currentUser: User;
  onBack: () => void;
  onProfileUpdated: (user: User) => void;
}

const EditProfileView: React.FC<EditProfileViewProps> = ({ currentUser, onBack, onProfileUpdated }) => {
  const { t, language } = useLocalization();
  const [firstName, setFirstName] = useState(currentUser.firstName || '');
  const [lastName, setLastName] = useState(currentUser.lastName || '');
  const [newsletterConsent, setNewsletterConsent] = useState(currentUser.newsletterConsent || false);
  const [aiRegion, setAiRegion] = useState<AIRegionPreference>((currentUser as any).aiRegionPreference || 'optimal');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingRegion, setIsUpdatingRegion] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleRegionChange = async (newRegion: AIRegionPreference) => {
    if (newRegion === aiRegion) return;

    setIsUpdatingRegion(true);
    setMessage(null);

    try {
      const { user } = await userService.updateAIRegionPreference(newRegion);
      setAiRegion(newRegion);
      onProfileUpdated(user);
      setMessage({
        type: 'success',
        text: `Data processing switched to ${newRegion === 'eu' ? '🇪🇺 EU' : newRegion === 'us' ? '🇺🇸 US' : '🌐 Optimal'}`
      });
    } catch (error) {
      console.error('Region update error:', error);
      setMessage({
        type: 'error',
        text: 'Error changing region'
      });
    } finally {
      setIsUpdatingRegion(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    try {
      const { user } = await userService.updateProfile(
        firstName.trim() || undefined,
        lastName.trim() || undefined,
        newsletterConsent
      );
      setMessage({ type: 'success', text: t('profile_success') });
      onProfileUpdated(user);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (error: any) {
      console.error('Profile update error:', error);
      setMessage({ type: 'error', text: t('profile_error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen animate-fadeIn">
      <div className="w-full max-w-md p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-content-primary uppercase">{t('profile_edit_title')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-bold text-content-secondary text-left">
              {t('profile_firstName_label')}
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isLoading}
              className="mt-1 w-full p-3 bg-background-tertiary dark:bg-background-primary text-content-primary border border-border-secondary dark:border-border-secondary focus:ring-accent-primary focus:outline-none focus:ring-1 disabled:opacity-50"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-bold text-content-secondary text-left">
              {t('profile_lastName_label')}
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isLoading}
              className="mt-1 w-full p-3 bg-background-tertiary dark:bg-background-primary text-content-primary border border-border-secondary dark:border-border-secondary focus:ring-accent-primary focus:outline-none focus:ring-1 disabled:opacity-50"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          <div className="flex items-start py-2">
            <input
              type="checkbox"
              id="newsletter"
              checked={newsletterConsent}
              onChange={(e) => setNewsletterConsent(e.target.checked)}
              disabled={isLoading}
              className="mt-1 w-4 h-4 text-accent-primary bg-background-tertiary border-border-secondary rounded focus:ring-accent-primary focus:ring-2 disabled:opacity-50"
            />
            <label htmlFor="newsletter" className="ml-3 text-sm text-content-secondary">
              <span className="font-bold">{t('profile_newsletter_label')}</span>
              <br />
              <span className="text-xs">{t('profile_newsletter_desc')}</span>
            </label>
          </div>

          {/* AI Region Preference */}
          <div className="pt-4 border-t border-border-secondary dark:border-border-primary">
            <label className="block text-sm font-bold text-content-secondary text-left mb-3">
              🌍 AI Data Processing
            </label>
            <div className="space-y-2">
              <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                aiRegion === 'eu'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-border-secondary dark:border-border-primary hover:bg-background-tertiary'
              } ${isUpdatingRegion ? 'opacity-50 cursor-wait' : ''}`}>
                <input
                  type="radio"
                  name="aiRegion"
                  value="eu"
                  checked={aiRegion === 'eu'}
                  onChange={() => handleRegionChange('eu')}
                  disabled={isUpdatingRegion || isLoading}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="ml-3">
                  <span className="font-bold text-content-primary">🇪🇺 EU (Mistral AI)</span>
                  <p className="text-xs text-content-secondary">
                    Processing in Paris, France. GDPR compliant.
                  </p>
                </div>
              </label>

              <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                aiRegion === 'optimal'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-border-secondary dark:border-border-primary hover:bg-background-tertiary'
              } ${isUpdatingRegion ? 'opacity-50 cursor-wait' : ''}`}>
                <input
                  type="radio"
                  name="aiRegion"
                  value="optimal"
                  checked={aiRegion === 'optimal'}
                  onChange={() => handleRegionChange('optimal')}
                  disabled={isUpdatingRegion || isLoading}
                  className="mt-1 w-4 h-4 text-green-600"
                />
                <div className="ml-3">
                  <span className="font-bold text-content-primary">🌐 Optimal</span>
                  <p className="text-xs text-content-secondary">
                    Best performance with automatic fallback.
                  </p>
                </div>
              </label>

              <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                aiRegion === 'us'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-border-secondary dark:border-border-primary hover:bg-background-tertiary'
              } ${isUpdatingRegion ? 'opacity-50 cursor-wait' : ''}`}>
                <input
                  type="radio"
                  name="aiRegion"
                  value="us"
                  checked={aiRegion === 'us'}
                  onChange={() => handleRegionChange('us')}
                  disabled={isUpdatingRegion || isLoading}
                  className="mt-1 w-4 h-4 text-purple-600"
                />
                <div className="ml-3">
                  <span className="font-bold text-content-primary">🇺🇸 US (Google Gemini)</span>
                  <p className="text-xs text-content-secondary">
                    Processing in USA. Fastest responses.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" onClick={onBack} disabled={isLoading} variant="secondary" size="lg" className="flex-1">
              {t('profile_cancel_button')}
            </Button>
            <Button type="submit" disabled={isLoading} loading={isLoading} size="lg" className="flex-1">
              {t('profile_save_button')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileView;
