import React, { useState } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import { LogInIcon } from './icons/LogInIcon';
import { UserIcon } from './icons/UserIcon';
import { UsersIcon } from './icons/UsersIcon';
import { InfoIcon } from './icons/InfoIcon';
import Button from './shared/Button';

interface AuthViewProps {
  onLogin: () => void;
  onGuest: () => void;
  redirectReason: string | null;
}

const AuthView: React.FC<AuthViewProps> = ({ onLogin, onGuest, redirectReason }) => {
  const { t } = useLocalization();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center animate-fadeIn">
      <div className="w-full max-w-md p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary rounded-lg shadow-lg">
        
        {redirectReason && (
            <div className="p-4 bg-status-info-background dark:bg-status-info-background border border-status-info-border dark:border-status-info-border/30 text-status-info-foreground dark:text-status-info-foreground flex items-start gap-3">
                <InfoIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-left">{redirectReason}</p>
            </div>
        )}

        <h1 className="text-3xl font-bold text-content-primary uppercase">{t('auth_title')}</h1>
        <p className="text-lg text-content-secondary leading-relaxed">
          {t('auth_subtitle')}
        </p>
        
        <div className="space-y-4 pt-4">
          <Button onClick={onLogin} disabled={isLoading} size="lg" fullWidth leftIcon={<LogInIcon className="w-6 h-6" />}>
            {t('auth_login')}
          </Button>
          <Button onClick={onGuest} disabled={isLoading} variant="outline" size="lg" fullWidth leftIcon={<UsersIcon className="w-6 h-6" />}>
            {t('auth_guest')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthView;