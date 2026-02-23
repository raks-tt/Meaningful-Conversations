import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocalization } from '../context/LocalizationContext';

interface DisclaimerViewProps {}

const en_markdown = `This application and the AI coaches contained within are for informational and educational purposes only.

## No Substitute for Professional Advice
The AI coaches are not licensed medical, legal, financial, or therapeutic professionals. The services provided therefore **expressly do not constitute and do not replace medical, psychological, or psychotherapeutic diagnosis, therapy, or healing treatment in any way**. Ongoing treatments in these areas should not be interrupted, discontinued, or refrained from as a result of the coaching. The conversations you have are not a substitute for advice from a qualified professional.

## Information in Emergencies
In acute psychological or medical crises or emergencies, the user is urged to immediately contact qualified medical or psychiatric professionals (doctor, hospital, emergency services) and not to use the provider's services.

## Personal Responsibility
The user acts **on their own responsibility** during and outside of coaching sessions at every stage of working with the application. The client is fully responsible for their physical and mental health and well-being during and after the completion of the coaching. All measures taken by the client as a result of the coaching are solely their responsibility.

## No Guarantee of Success and Liability for Content
The application and the AI coaches serve as a tool for process support and information. The provider does not guarantee the subjective effectiveness or success of the advice or insights provided. The statutory warranty for the **functionality of the application** (as described in the manual) remains unaffected.

## Limitation of Liability (Damages)
(1) The provider's liability for damages is limited to intent or gross negligence.
(2) Liability for **personal injury** (injury to life, body, or health) based on slight negligence is **not** excluded or limited by these terms and conditions.
(3) In all other respects (pure financial losses), the provider's liability for slight negligence is excluded, provided that it does not involve the violation of cardinal obligations. In this case, the liability is limited to the fee actually paid by the user for the specific service.`;


const DisclaimerView: React.FC<DisclaimerViewProps> = () => {
    const { t } = useLocalization();

    return (
        <div className="w-full max-w-3xl mx-auto p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary mt-4 mb-10 animate-fadeIn rounded-lg shadow-lg">
            <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-content-primary uppercase">{t('disclaimer_title')}</h1>
            </div>
            <div className="prose dark:prose-invert max-w-none text-content-secondary space-y-4 leading-relaxed">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-content-primary mt-8 mb-4 not-prose" {...props} />,
                    }}
                >
                    {en_markdown}
                </ReactMarkdown>
            </div>
        </div>
    );
};

export default DisclaimerView;
