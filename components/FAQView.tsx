import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { useLocalization } from '../context/LocalizationContext';

interface InfoViewProps {
}

const en_markdown = `
## General

### What is the "Life Context" file?
The Life Context file (.md) is a central document that serves as your coach's memory. It contains your goals, challenges, routines, and important background information. After each session, the AI analyzes your conversation and suggests updates to keep this file current, allowing for continuous and contextual coaching. You have full control over what gets saved.

### Can I use the app for free?
Yes! The app offers a guest mode with access to a selection of coaches. In guest mode, all your data, including your Life Context file, is processed locally in your browser and is never sent to our servers. You are responsible for saving and loading your file for each session. Registered users get access to more coaches and features like encrypted cloud storage.

### What is Gamification?
Gamification elements like XP, levels, and streaks are designed to motivate you to engage in regular self-reflection. You earn XP for participating in conversations, and you can receive special bonuses. A **50 XP bonus** is awarded for guiding a session to a natural conclusion, and a **25 XP bonus** is awarded if you report completing a pre-existing goal. Completing sessions and reaching milestones unlocks achievements and rewards your commitment to personal growth.

---

## Registered Users

### How is my data protected?
We use end-to-end encryption (E2EE) for your Life Context file. When you register, your password is used to create an encryption key that ONLY you have. Your data is encrypted on your device before it's sent to our servers and can only be decrypted on your device with your password. **We cannot read your data, and we cannot recover your password.**

### What happens if I forget my password?
Due to our E2EE security model, **if you forget your password, your encrypted Life Context file is permanently lost.** When you reset your password, a new encryption key is created, and your old, unreadable data is deleted from our servers. We strongly recommend regularly downloading a backup of your Life Context file.

---

## Coaching & AI

### The coach's response isn't helpful. What can I do?
AI is a powerful tool, but it's not perfect. If a response is unhelpful, try rephrasing your statement or providing more context. You can also gently guide the coach back on track by saying something like, "Let's go back to..." or "I'd like to focus on...". You can report specific problematic responses directly in the chat using the flag icon that appears next to the coach's message. Additionally, after the session, you can use the overall feedback and rating system to report issues, which helps us improve the system.

### Can I change coaches during a session?
You choose a coach at the start of each session. If you feel another coach's style would be more beneficial, you can end the current session. After the session review, you will have the option to "Switch Coach," which will take you back to the coach selection screen with your updated Life Context.
`;

const FAQView: React.FC<InfoViewProps> = () => {
    const { t } = useLocalization();

    return (
        <div className="w-full max-w-3xl mx-auto p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary mt-4 mb-10 animate-fadeIn rounded-lg shadow-lg">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-content-primary uppercase">{t('faq_title')}</h1>
            </div>
            <div className="prose dark:prose-invert max-w-none text-content-secondary space-y-4 leading-relaxed">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-content-primary mt-8 mb-4 not-prose" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-content-primary mt-6 mb-2 not-prose" {...props} />,
                    }}
                >
                    {en_markdown}
                </ReactMarkdown>

                <div className="not-prose">
                    <h3 className="text-lg font-semibold text-content-primary mt-6 mb-2">
                        Why does voice mode not work or why is the voice quality poor?
                    </h3>
                     <p className="text-content-secondary leading-relaxed">
                        Voice mode relies on your browser's built-in Web Speech API. Support and quality can vary significantly:
                    </p>
                    <div className="space-y-3 my-4">
                        <div className="bg-background-tertiary dark:bg-background-tertiary p-3 border border-border-primary dark:border-border-primary text-sm">
                            <p className="text-content-secondary"><strong>Browser:</strong> Chrome and Edge generally have the best support. Firefox and Safari may have limitations or lower quality voices.</p>
                        </div>
                        <div className="bg-background-tertiary dark:bg-background-tertiary p-3 border border-border-primary dark:border-border-primary text-sm">
                             <p className="text-content-secondary"><strong>Operating System:</strong> Your operating system provides the voices. Some operating systems offer 'premium' or 'enhanced' voices that you may need to download in your system settings (Accessibility/Speech).</p>
                        </div>
                    </div>
                     <p className="text-content-secondary leading-relaxed">
                        For the best experience, we recommend using a modern Chromium-based browser (like Chrome or Edge) on a desktop operating system.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FAQView;
