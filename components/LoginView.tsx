import React, { useState, useMemo } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import * as userService from '../services/userService';
import { User } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import Button from './shared/Button';
import { deriveKey, hexToUint8Array } from '../utils/encryption';
import { InfoIcon } from './icons/InfoIcon';
import ChristmasSnowflakes from './ChristmasSnowflakes';
import SpringBlossoms from './SpringBlossoms';
import SummerButterflies from './SummerButterflies';
import AutumnLeaves from './AutumnLeaves';
import { isChristmasSeason, isSpringSeason, isSummerSeason, isAutumnSeason } from '../utils/dateUtils';

interface LoginViewProps {
  onLoginSuccess: (user: User, key: CryptoKey) => void;
  onBack: () => void;
  reason?: string | null;
}

const REMEMBER_EMAIL_KEY = 'rememberedEmail';

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onBack, reason }) => {
  const { t } = useLocalization();
  
  // Load remembered email from localStorage on mount
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !!localStorage.getItem(REMEMBER_EMAIL_KEY);
    } catch {
      return false;
    }
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const showChristmas = useMemo(() => isChristmasSeason(), []);
  const showSpring = useMemo(() => isSpringSeason(), []);
  const showSummer = useMemo(() => isSummerSeason(), []);
  const showAutumn = useMemo(() => isAutumnSeason(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    try {
        const { user, token } = await userService.login(trimmedEmail, trimmedPassword);
        
        if (!user.encryptionSalt) {
            throw new Error("Encryption salt is missing for this user.");
        }
        
        const saltBytes = hexToUint8Array(user.encryptionSalt);
        const key = await deriveKey(trimmedPassword, saltBytes);
        
        try {
            if (rememberMe) {
                localStorage.setItem(REMEMBER_EMAIL_KEY, trimmedEmail);
            } else {
                localStorage.removeItem(REMEMBER_EMAIL_KEY);
            }
        } catch (e) {
            console.warn('Could not save remember email preference:', e);
        }

        onLoginSuccess(user, key);

    } catch (err: any) {
        console.error("Login failed:", err);
        if (err.isNetworkError) {
            setError(t('error_network_detailed', { url: err.backendUrl }));
        } else if (err.status === 401) {
            setError(t('login_error_credentials'));
        } else if (err.status === 403) {
            setError(err.message || 'An error occurred.'); // The backend sends a specific "pending verification" message.
        } else {
            setError(err.message || 'An unknown error occurred. Please try again.');
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen animate-fadeIn">
      {showChristmas && <ChristmasSnowflakes darkModeOnly={true} />}
      {showSpring && <SpringBlossoms lightModeOnly={true} />}
      {showSummer && <SummerButterflies lightModeOnly={true} />}
      {showAutumn && <AutumnLeaves />}
      <div className="relative w-full max-w-md p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary rounded-lg shadow-lg">
        <button onClick={onBack} className="absolute left-4 top-4 p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-border-primary dark:hover:bg-border-primary transition-colors">
            <ArrowLeftIcon className="w-6 h-6 text-content-secondary" />
        </button>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-content-primary uppercase">{t('login_title')}</h1>
        </div>

        {reason && (
            <div className="p-4 bg-status-info-background dark:bg-status-info-background border border-status-info-border dark:border-status-info-border/30 text-status-info-foreground dark:text-status-info-foreground flex items-start gap-3 text-sm text-left">
                <InfoIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p>{reason}</p>
            </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-content-secondary text-left">{t('login_email_label')}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login_email_placeholder')}
              required
              disabled={isLoading}
              className="mt-1 w-full p-3 bg-background-tertiary dark:bg-background-primary text-content-primary border border-border-secondary dark:border-border-secondary focus:outline-none focus:ring-1 focus:ring-accent-primary disabled:opacity-50"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>
          <div>
            <label htmlFor="password"  className="block text-sm font-bold text-content-secondary text-left">{t('login_password_label')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="mt-1 w-full p-3 bg-background-tertiary dark:bg-background-primary text-content-primary border border-border-secondary dark:border-border-secondary focus:outline-none focus:ring-1 focus:ring-accent-primary disabled:opacity-50"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
            <div className="mt-2">
                <label className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={isLoading}
                        className="h-4 w-4 bg-background-secondary dark:bg-background-tertiary border-border-secondary text-accent-primary focus:ring-accent-primary rounded disabled:opacity-50"
                    />
                    <span className="ml-2 text-xs text-content-secondary">{t('login_remember_email') || 'E-Mail merken'}</span>
                </label>
            </div>
          </div>

          {error && <p className="text-status-danger-foreground text-sm whitespace-pre-wrap">{error}</p>}
          
          <Button type="submit" disabled={isLoading} loading={isLoading} size="lg" fullWidth>
            {t('login_button')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginView;