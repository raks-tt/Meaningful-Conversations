import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, NavView } from '../types';
import { useLocalization } from '../context/LocalizationContext';
import { useModalOpen } from '../utils/modalUtils';
import { LogInIcon } from './icons/LogInIcon';
import { UserIcon } from './icons/UserIcon';
import { LogOutIcon } from './icons/LogOutIcon';
import { RepeatIcon } from './icons/RepeatIcon';
import { XIcon } from './icons/XIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { ListIcon } from './icons/ListIcon';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { CodeIcon } from './icons/CodeIcon';
import { GearIcon } from './icons/GearIcon';
import { KeyIcon } from './icons/KeyIcon';
import { ClipboardCheckIcon } from './icons/ClipboardCheckIcon';

interface BurgerMenuProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User | null;
    onNavigate: (view: NavView) => void;
    onLogout: () => void;
    onStartOver: () => void;
}

const BurgerMenu: React.FC<BurgerMenuProps> = ({ isOpen, onClose, currentUser, onNavigate, onLogout, onStartOver }) => {
    const { t } = useLocalization();
    useModalOpen(isOpen);
    
    // iOS Safe Area calculation (same as GamificationBar)
    const isIOS = (window as any).Capacitor?.getPlatform?.() === 'ios';
    const getIOSSafeAreaTop = (): number => {
        if (!isIOS) return 0;
        const screenHeight = Math.max(window.screen.height, window.screen.width);
        if (screenHeight >= 932) return 52;  // iPhone 14/15 Pro Max (Dynamic Island)
        if (screenHeight >= 852) return 52;  // iPhone 14/15 Pro (Dynamic Island)
        if (screenHeight >= 844) return 44;  // iPhone 12/13/14/15 (notch)
        if (screenHeight >= 812) return 44;  // iPhone X/XS/11 Pro (notch)
        return 20;
    };
    const iosSafeAreaTop = getIOSSafeAreaTop();
    const isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
    const nativeBarOffset = isIOS && !isLandscape ? 60 : 0;
    
    const handleRefresh = async () => {
        // Dynamic import to avoid issues if module doesn't exist yet
        try {
            const { updateServiceWorker } = await import('../utils/serviceWorkerUtils');
            await updateServiceWorker();
        } catch (error) {
            console.error('Update failed, performing normal reload:', error);
            window.location.reload();
        }
    };

    const menuPaddingTop = isIOS && iosSafeAreaTop > 0
        ? `${iosSafeAreaTop + nativeBarOffset + 8}px`
        : '1.5rem';

    if (!isOpen) return null;
    
    const handleLogout = () => {
        onLogout();
        onClose();
    };

    const handleStartOverAndClose = () => {
        onStartOver();
        onClose();
    }

    return createPortal(
        <div 
            className="fixed inset-0 z-[9998] flex justify-start"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="w-full max-w-sm h-full bg-background-secondary shadow-2xl p-6 flex flex-col animate-slideInFromLeft pb-[max(2.5rem,calc(var(--safe-area-inset-bottom)+1rem))]"
                style={{ paddingTop: menuPaddingTop }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-content-primary uppercase">{t('menu_title')}</h2>
                    <button onClick={onClose} className="p-2 -mr-2 text-content-secondary hover:text-content-primary">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                
                <nav className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                    <MenuItem icon={RepeatIcon} text={t('menu_start_over')} onClick={handleStartOverAndClose} />
                    <hr className="border-border-primary my-2" />
                    
                    {currentUser?.isAdmin && (
                        <>
                            <MenuItem icon={GearIcon} text={t('menu_admin')} onClick={() => onNavigate('admin')} />
                             <hr className="border-border-primary my-2" />
                        </>
                    )}

                    {/* Items moved to the top */}
                    <MenuItem icon={UserIcon} text={t('menu_about')} onClick={() => onNavigate('about')} />
                    <MenuItem icon={ListIcon} text={t('menu_legal')} onClick={() => onNavigate('legal')} />
                    <MenuItem icon={ShieldIcon} text={t('menu_disclaimer')} onClick={() => onNavigate('disclaimer')} />

                    <hr className="border-border-primary my-2" />
                    
                    {currentUser && (
                        <>
                            <MenuItem icon={UserIcon} text={t('menu_account_management')} onClick={() => onNavigate('accountManagement')} />
                            <MenuItem icon={ClipboardCheckIcon} text={t('menu_personality_profile')} onClick={() => onNavigate('personalityProfile')} />
                            <hr className="border-border-primary my-2" />
                        </>
                    )}

                    <MenuItem
                        icon={BookOpenIcon}
                        text={t('menu_user_guide')}
                        onClick={() => onNavigate('userGuide')}
                    />
                    <MenuItem icon={QuestionMarkCircleIcon} text={t('menu_faq')} onClick={() => onNavigate('faq')} />
                    <MenuItem icon={CodeIcon} text={t('menu_formatting')} onClick={() => onNavigate('formattingHelp')} />
                </nav>

                <div className="mt-auto pt-4 border-t border-border-primary">
                    {currentUser ? (
                        <>
                            <div className="px-4 py-3 text-sm text-content-subtle text-left truncate">
                                {currentUser.email}
                            </div>
                            <MenuItem icon={LogOutIcon} text={t('menu_logout')} onClick={handleLogout} specialColor="text-status-danger-foreground hover:bg-status-danger-background" />
                        </>
                    ) : (
                        <MenuItem icon={LogInIcon} text={t('menu_login')} onClick={() => onNavigate('auth')} />
                    )}
                    
                    <div className="px-4 pt-2 pb-2 flex items-center justify-between">
                        <p className="text-xs text-content-subtle">
                            Version {import.meta.env.VITE_APP_VERSION || 'unknown'}
                            {import.meta.env.VITE_BUILD_NUMBER && ` (Build ${import.meta.env.VITE_BUILD_NUMBER})`}
                        </p>
                        <button
                            onClick={handleRefresh}
                            className="p-1.5 rounded-full hover:bg-background-tertiary transition-colors"
                            title={t('menu_refresh_app') || 'App aktualisieren'}
                        >
                            <RepeatIcon className="w-4 h-4 text-content-subtle hover:text-content-primary" />
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const MenuItem: React.FC<{ icon: React.ElementType, text: string, onClick: () => void, specialColor?: string, customText?: React.ReactNode }> = ({ icon: Icon, text, onClick, specialColor, customText }) => (
    <button 
        onClick={onClick} 
        className={`w-full flex items-center gap-4 px-4 py-3 text-left rounded-md transition-colors ${
            specialColor 
                ? specialColor 
                : 'text-content-secondary hover:bg-background-tertiary'
        }`}
    >
        <Icon className={`w-6 h-6 ${specialColor ? '' : 'text-content-subtle'}`} />
        <span className="font-semibold">{customText ?? text}</span>
    </button>
);


export default BurgerMenu;