import React, { useState, useEffect } from 'react';
import { Bot, BotWithAvailability, User, Language, CoachingMode } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { getBots } from '../services/userService';
import { MediationIcon } from './icons/MediationIcon';
import Spinner from './shared/Spinner';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';

interface BotSelectionProps {
  onSelect: (bot: Bot) => void;
  onTranscriptEval?: () => void;
  currentUser: User | null;
  hasPersonalityProfile?: boolean;
  coachingMode?: CoachingMode;
}

interface BotCardProps {
  bot: BotWithAvailability;
  onSelect: (bot: Bot) => void;
  hasPersonalityProfile?: boolean;
  coachingMode?: CoachingMode;
}

const BotCard: React.FC<BotCardProps> = ({ bot, onSelect, hasPersonalityProfile, coachingMode }) => {
    const { t } = useLocalization();
    const isLocked = false;
    const hasMeditation = bot.id === 'rob' || bot.id === 'kenji-stoic' || bot.id === 'chloe-cbt';
    // Nobody (nexus-gps) doesn't support DPFL - show DPC instead
    // DPFL requires full coaching sessions which Nobody doesn't conduct
    // Gloria Interview has no coaching integration at all - never show badge
    const isNonCoachingBot = bot.id === 'gloria-interview';
    const effectiveCoachingMode = isNonCoachingBot ? undefined : (bot.id === 'nexus-gps' && coachingMode === 'dpfl') ? 'dpc' : coachingMode;
    // Show coaching mode badge for all bots if profile exists and mode is active
    const showCoachingBadge = hasPersonalityProfile && effectiveCoachingMode && effectiveCoachingMode !== 'off';

    return (
      <div
        onClick={() => onSelect(bot)}
        className="relative flex flex-col items-center text-center p-6 bg-background-secondary dark:bg-transparent border border-border-primary dark:border-border-primary hover:border-accent-primary dark:hover:border-accent-primary transition-[box-shadow,transform] duration-200 rounded-lg shadow-md cursor-pointer hover:shadow-xl dark:hover:shadow-none hover:-translate-y-1 [-webkit-tap-highlight-color:transparent]"
      >
        
        {/* Coaching Mode Badge (non-interactive) - Text badge in top right */}
        {showCoachingBadge && (
          <div 
            className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold"
            title={`${t('profile_coaching_mode_title')}: ${effectiveCoachingMode?.toUpperCase()}`}
          >
            {effectiveCoachingMode?.toUpperCase()}
          </div>
        )}
        
        <div className="relative flex-shrink-0">
            <img
                src={bot.avatar}
                alt={bot.name}
                className="w-24 h-24 rounded-full"
            />
            {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                    <LockIcon className="w-8 h-8 text-white" />
                </div>
            )}
            {hasMeditation && (
                <div 
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent-primary flex items-center justify-center shadow-md"
                    title={t('botSelection_meditationBadge')}
                >
                    <MediationIcon className="w-4 h-4 text-button-foreground-on-accent" />
                </div>
            )}
        </div>

        <div className="mt-4 flex flex-col flex-1 justify-between">
            <div>
                <h2 className="text-2xl font-bold text-content-primary dark:text-content-primary">{bot.name}</h2>
                
                
                <div className="flex flex-wrap justify-center gap-2 my-3">
                    {bot.style.split(', ').map((tag, index) => {
                        const isFirstTag = index === 0;
                        const tagClass = isFirstTag
                            ? 'bg-accent-primary/20 text-accent-primary-hover'
                            : 'bg-background-tertiary text-content-secondary dark:bg-background-tertiary dark:text-content-secondary';

                        return (
                            <span key={tag} className={`px-2.5 py-1 text-xs font-bold tracking-wide uppercase rounded-full ${tagClass}`}>
                                {tag}
                            </span>
                        );
                    })}
                </div>
            </div>
            <p className="mt-1 text-content-secondary dark:text-content-secondary leading-relaxed text-base">
                {bot.description}
            </p>
        </div>
      </div>
    );
};

const BotSelection: React.FC<BotSelectionProps> = ({ onSelect, onTranscriptEval, currentUser, hasPersonalityProfile, coachingMode }) => {
  const { t } = useLocalization();
  const [bots, setBots] = useState<BotWithAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // Track window width for responsive Transcript Evaluation card
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchAndSetBots = async () => {
      setIsLoading(true);
      try {
        const fetchedBots: Bot[] = await getBots();

        const availableBots: BotWithAvailability[] = fetchedBots
          .filter(bot => bot.id !== 'gloria-life-context') // Filter out the hidden interview bot
          .map(bot => ({
              ...bot,
              isAvailable: true
          }));
        setBots(availableBots);
      } catch (error) {
          console.error("Failed to fetch bots:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndSetBots();
  }, [currentUser]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center py-20">
              <Spinner />
          </div>
      );
  }

  return (
    <div className="pt-4 pb-10 animate-fadeIn">
      <div className="w-full max-w-6xl mx-auto mb-8 text-center">
        <h1 className="text-4xl font-bold text-content-primary dark:text-content-primary uppercase">{t('botSelection_title')}</h1>
        <p className="mt-2 text-lg text-content-secondary dark:text-content-secondary leading-relaxed">
          {t('botSelection_subtitle')}
        </p>
      </div>

      {/* All Bots Grid */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onSelect={onSelect}
              hasPersonalityProfile={hasPersonalityProfile}
              coachingMode={coachingMode}
            />
          ))}
        </div>

        {/* Transcript Evaluation */}
        {onTranscriptEval && (
          <div className="max-w-4xl mx-auto mt-8">
            <div
              onClick={() => onTranscriptEval()}
              className="cursor-pointer border-border-primary hover:border-accent-primary bg-background-secondary/50 dark:bg-transparent hover:bg-background-secondary dark:hover:bg-background-secondary/10 shadow-sm hover:shadow-md flex items-center gap-3 px-4 py-3 rounded-lg border transition-all"
            >
              <span className="text-xl flex-shrink-0">📋</span>
              <span className="text-base font-semibold text-content-primary">{t('te_title')}</span>
              <span className="text-sm text-content-secondary hidden sm:inline">{t('te_description')}</span>
              <span className="ml-auto text-content-secondary text-sm">→</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotSelection;