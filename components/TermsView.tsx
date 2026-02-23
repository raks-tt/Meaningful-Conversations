import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { useLocalization } from '../context/LocalizationContext';

interface InfoViewProps {
}

const en_markdown = `These Terms of Service ("Terms") govern your use of the "Meaningful Conversations" application (the "Service"). By accessing or using the Service, you agree to be bound by these Terms.

## 1. Description of Service
The Service provides access to AI-powered coaching conversations intended for self-reflection and personal development. Users can personalize their sessions using a "Life Context" file. The service is available in two modes:

- **Guest Mode:** Data processing occurs entirely locally in the user's browser. The user is responsible for saving and managing their data.
- **Registered Mode:** Offers additional features, including automatic saving of the Life Context, which is end-to-end encrypted.

## 2. User Accounts and Data Security
**Registered Users:** You are responsible for maintaining the confidentiality of your password. Due to end-to-end encryption, we have no access to your password or your encrypted "Life Context" data. **If you lose or reset your password, your encrypted data will be permanently and irrecoverably lost.** It is your responsibility to make regular backups of your data by downloading the file.

**Guest Users:** You are solely responsible for saving and managing your "Life Context" file, as no data is stored on our servers.

## 3. User Responsibilities
You agree not to use the Service for any unlawful purpose. You act **on your own responsibility** during and outside of coaching sessions at every stage of working with the application. You are fully responsible for your physical and mental health and well-being. All measures taken as a result of the coaching are solely your responsibility.

## 4. Service Availability and Modifications
We reserve the right to modify or discontinue the Service, or any feature thereof, at any time without notice. The statutory warranty for the **functionality of the application** (as described in the user manual) remains unaffected.

## 5. Changes to Terms
We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms within the Service.
`;

const TermsView: React.FC<InfoViewProps> = () => {
    const { t } = useLocalization();
    const markdownContent = en_markdown;

    return (
        <div className="w-full max-w-3xl mx-auto p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary mt-4 mb-10 animate-fadeIn rounded-lg shadow-lg">
            <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-content-primary uppercase">{t('terms_title')}</h1>
            </div>
            <div className="prose dark:prose-invert max-w-none text-content-secondary space-y-4 leading-relaxed">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-content-primary mt-8 mb-4 not-prose" {...props} />,
                    }}
                >
                    {markdownContent}
                </ReactMarkdown>
            </div>
        </div>
    );
};

export default TermsView;
