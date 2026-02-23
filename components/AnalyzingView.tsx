import React from 'react';
import { createPortal } from 'react-dom';
import Spinner from './shared/Spinner';
import { useLocalization } from '../context/LocalizationContext';
import { useModalOpen } from '../utils/modalUtils';

const AnalyzingView: React.FC = () => {
    const { t } = useLocalization();
    useModalOpen();
    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center animate-fadeIn text-center">
            <Spinner />
            <h1 className="mt-6 text-2xl font-bold text-gray-200">{t('analyzing_title')}</h1>
            <p className="mt-2 text-lg text-gray-400">{t('analyzing_subtitle')}</p>
        </div>,
        document.body
    );
};

export default AnalyzingView;