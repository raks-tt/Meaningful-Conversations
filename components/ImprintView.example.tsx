import React from 'react';
import { useLocalization } from '../context/LocalizationContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ImprintViewProps {
    onBack?: () => void;
}

const en_markdown = `Information in accordance with § 5 ECG (Austrian E-Commerce Act), § 25 MedienG (Austrian Media Act) and Art. 13 GDPR

## Media Owner and Service Provider

**Max Mustermann, MSc**
Life and Social Counseling
Musterstrasse 123
1010 Vienna
Austria

Business: Life and Social Counseling
Professional Title: Life and Social Counselor
Supervisory Authority: City of Vienna Magistrate
Country of Business: Austria

## Contact

**Email:** example@example.com
**Phone:** +43 123 4567890
**Website:** www.example.com

---

## VAT

As a small business owner according to § 6 para. 1 Z 27 UStG (Austrian VAT Act), no VAT is charged.

---

## Disclaimer

### Liability for Content

The contents of this website have been created with the greatest care. However, we cannot guarantee the accuracy, completeness, and timeliness of the content. As a service provider, we are responsible for our own content in accordance with § 16 ECG (Austrian E-Commerce Act) under general law. According to § 18 ECG, however, we are not obligated as a service provider to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity.

### Liability for Links

Our offer contains links to external third-party websites over whose content we have no influence. Therefore, we cannot assume any liability for this third-party content. The respective provider or operator of the pages is always responsible for the content of the linked pages.

### Copyright

The content and works created by the site operators on these pages are subject to Austrian copyright law. The reproduction, editing, distribution, and any kind of exploitation outside the limits of copyright require the written consent of the respective author or creator.

---

## Notice Regarding AI Usage

This application uses artificial intelligence (Google Gemini API) to provide coaching functions. AI-generated responses do not replace professional psychological or medical advice. If you have serious mental health issues, please consult qualified professionals.

---

## EU Dispute Resolution

The European Commission provides a platform for online dispute resolution (ODR):
**https://ec.europa.eu/consumers/odr**

You can find our email address in the imprint above.`;

const ImprintView: React.FC<ImprintViewProps> = ({ onBack }) => {
    const { t } = useLocalization();

    return (
        <div className="w-full max-w-4xl mx-auto p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary my-10 animate-fadeIn rounded-lg shadow-lg">
            <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-content-primary uppercase">{t('imprint_title')}</h1>
            </div>

            <div className="prose dark:prose-invert max-w-none text-content-secondary space-y-4 leading-relaxed">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-content-primary mt-8 mb-4 not-prose" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-content-primary mt-6 mb-3 not-prose" {...props} />,
                    }}
                >
                    {en_markdown}
                </ReactMarkdown>
            </div>

            {onBack && (
                <div className="flex justify-center pt-6">
                    <button
                        onClick={onBack}
                        className="px-6 py-2 text-base font-bold text-white bg-accent-primary uppercase hover:bg-accent-primary-hover disabled:bg-accent-disabled rounded-lg shadow-md"
                    >
                        {t('back')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ImprintView;
