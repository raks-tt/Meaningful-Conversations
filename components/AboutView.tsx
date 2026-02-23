import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { useLocalization } from '../context/LocalizationContext';
import { HowItWorks } from './HowItWorks';

interface InfoViewProps {
}

const en_markdown_part1 = `Do you want to deepen the insights from your coaching in your daily life or are you looking for a straightforward way to self-reflection? "Meaningful Conversations" was developed precisely for this purpose. The app is your intelligent complement to professional coaching and a modern alternative to a self-help book – a personal space for your development that is available to you at any time.

## Our philosophy: Questions instead of Answers

We are convinced: You already carry the best answers within you. Our mission is to help you find them through clear and focused dialogue. Based on the strengths-oriented approach of Positive Psychology, we create an absolutely private space for your insights. We ask the right questions so you can grow.
`;

const en_centered_text = `In the spirit of: **Do it yourself, but not alone\\!**`;

const en_markdown_part2 = `
## How it works

"Meaningful Conversations" connects your personal notes and goals with advanced AI from Google (US) or Mistral (EU). Imagine a private coach with a great memory and confidential notes: The app works with the context of your previous conversations. This allows you to pursue goals, view challenges from different angles, and sustainably reflect on your progress.
`;

const en_final_sentence = `This application is a project born from a passion for personal growth and technology. We hope it serves as a valuable support on your journey.`;

const en_highlight = `And if you want direct exchange, you can contact a certified life and social counselor at any time via [**manualmode.at**](http://manualmode.at).`;


type AboutTab = 'about' | 'coach';

const AboutView: React.FC<InfoViewProps> = () => {
    const { t } = useLocalization();
    const [activeTab, setActiveTab] = useState<AboutTab>('coach');

    return (
        <div className="flex flex-col items-center w-full space-y-8">
            <div className="w-full max-w-3xl mx-auto p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary mt-4 mb-10 animate-fadeIn rounded-lg shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-content-primary uppercase">{t('about_title')}</h1>
                    <p className="mt-1 text-sm text-content-subtle">{t('about_version')} 1.9.2</p>
                </div>
                <div className="flex items-center justify-evenly border-b border-border-secondary dark:border-border-primary">
                    <button
                        type="button"
                        onClick={() => setActiveTab('coach')}
                        className={`pb-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
                            activeTab === 'coach'
                                ? 'text-accent-primary border-b-2 border-accent-primary'
                                : 'text-content-tertiary hover:text-content-primary'
                        }`}
                    >
                        {t('about_coach_tab') || 'A Coach Who Knows You'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('about')}
                        className={`pb-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
                            activeTab === 'about'
                                ? 'text-accent-primary border-b-2 border-accent-primary'
                                : 'text-content-tertiary hover:text-content-primary'
                        }`}
                    >
                        {t('about_about_tab') || 'About This App'}
                    </button>
                </div>
                <div className="prose dark:prose-invert max-w-none text-content-secondary space-y-4 leading-relaxed">
                    {activeTab === 'about' && (
                        <>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-content-primary mt-8 mb-4 not-prose" {...props} />,
                                }}
                            >
                                {en_markdown_part1}
                            </ReactMarkdown>

                            <div className="not-prose my-10 py-6 px-8 text-center bg-background-tertiary/30 dark:bg-background-tertiary/10 border-y border-border-secondary dark:border-border-primary">
                                <div className="flex items-center justify-center gap-4 mb-2">
                                    <span className="w-12 h-px bg-accent-tertiary/50"></span>
                                    <span className="text-accent-tertiary text-2xl">✦</span>
                                    <span className="w-12 h-px bg-accent-tertiary/50"></span>
                                </div>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({node, ...props}) => <p className="mb-0 text-xl italic text-accent-tertiary dark:text-accent-tertiary" {...props} />,
                                    }}
                                >
                                    {en_centered_text}
                                </ReactMarkdown>
                            </div>

                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-content-primary mt-8 mb-4 not-prose" {...props} />,
                                }}
                            >
                                {en_markdown_part2}
                            </ReactMarkdown>

                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {en_final_sentence}
                            </ReactMarkdown>
                        </>
                    )}
                    {activeTab === 'coach' && (
                        <HowItWorks />
                    )}
                </div>
                {activeTab === 'about' && (
                    <div className="p-4 mt-6 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-400 dark:border-emerald-600 rounded-lg not-prose">
                        <div className="flex items-start gap-3">
                            <div className="text-2xl mt-0.5">✅</div>
                            <div>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({node, ...props}) => <p className="text-left text-content-secondary" {...props} />,
                                        a: ({node, ...props}) => <a className="font-semibold hover:underline text-accent-tertiary dark:text-accent-tertiary" target="_blank" rel="noopener noreferrer" {...props} />
                                    }}
                                >
                                    {en_highlight}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AboutView;
