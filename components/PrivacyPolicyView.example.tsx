import React from 'react';
import { useLocalization } from '../context/LocalizationContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PrivacyPolicyViewProps {
    onBack?: () => void;
}

const en_markdown = `This Privacy Policy explains the nature, scope, and purpose of the processing of personal data (hereinafter referred to as "data") within the provision of our services and within our online offering and the websites, functions, and content associated with it (hereinafter collectively referred to as "online offering").

## 1. Controller

**Responsible for data processing:**

Max Mustermann, MSc
Life and Social Counseling
Musterstrasse 123
1010 Vienna
Austria

**Contact:**
Email: example@example.com
Phone: +43 123 4567890
Website: www.example.com

## 2. Types of Data Processed

- Email address (upon registration)
- **First name and last name (optional, voluntary upon registration)**
- Password (encrypted with bcrypt)
- End-to-end encrypted Life Context data
- Gamification data (XP, Level, Streak, Achievements)
- Technical access data (IP address, browser type, access time)
- API usage data (number of API calls, models used, timestamps)
- Feedback (optional and only if submitted by user)

## 3. Purpose of Processing

Data is processed for the following purposes:

- **Provision of coaching functions:** Enabling AI-powered coaching conversations
- **Account management:** Registration, login, password management
- **Personalized address (optional):** Use of your name for more personal coaching conversation guidance, if you provided a name during registration
- **Email communication:**
  - Sending verification and password reset emails (required)
  - Newsletter with news and updates (only with your consent)
- **Progress tracking:** Storing gamification data (XP, Level, Achievements)
- **Cost control:** Monitoring API usage for cost management
- **Service improvement:** Analyzing feedback to improve our offering

## 4. Legal Basis for Processing

The processing of your personal data is based on the following legal grounds:

- **Art. 6 para. 1 lit. b GDPR:** Processing for contract fulfillment (provision of services)
- **Art. 6 para. 1 lit. a GDPR:** Consent
  - For voluntary provision of first and last name for personalized address
  - For newsletter subscription (revocable anytime in account settings)
  - For voluntary feedback
- **Art. 6 para. 1 lit. f GDPR:** Legitimate interest (e.g., API cost control, security measures)

### Withdrawal of Consent
You can withdraw your consent to newsletter use at any time:
1. In app settings under "My Account" → "Edit Profile"
2. By email to example@example.com

Withdrawal does not affect the lawfulness of processing carried out before withdrawal.

## 5. Recipients and Transfer of Data

Your data is transferred to the following recipients:

### 5.1 Google Gemini API (Data Processor)
- **Purpose:** AI-powered conversation processing
- **Location:** USA (with EU Standard Contractual Clauses)
- **Legal basis:** Art. 28 GDPR (Data Processing Agreement)
- **Note:** Your conversations are sent to Google for processing. The encrypted Life Context is NOT transmitted.

#### Performance Optimization (Prompt Caching)
To improve response times, we use the caching feature of the Gemini API. Parts of your Life Context (unencrypted, as with every API request) are temporarily stored on Google LLC (USA) servers for up to **5 minutes**. The cached data:
- Is only accessible for your own requests
- Is transmitted and stored encrypted
- Is automatically deleted after 5 minutes at the latest
- Is used exclusively to speed up consecutive messages within an active coaching session

**Legal basis:** Art. 6 para. 1 lit. f GDPR (legitimate interest in efficient service provision).

### 5.2 Mailjet (Data Processor)
- **Purpose:** Email delivery (verification, password reset)
- **Location:** France (EU)
- **Legal basis:** Art. 28 GDPR (Data Processing Agreement)

### 5.3 Hetzner Online GmbH (Data Processor)
- **Purpose:** Server hosting
- **Location:** Germany (EU)
- **Legal basis:** Art. 28 GDPR (Data Processing Agreement)

## 6. Data Security

We employ technical and organizational security measures to protect your data against accidental or intentional manipulation, loss, destruction, or access by unauthorized persons:

- **End-to-End Encryption (E2EE):** Your Life Context is encrypted on your device before being sent to our servers. Only you can decrypt the data with your password.
- **Password Hashing:** Passwords are hashed with bcrypt using 10 salting rounds.
- **HTTPS/TLS:** All data transmissions are SSL/TLS encrypted.
- **Regular security updates:** Servers and software are regularly updated.

**IMPORTANT:** Due to end-to-end encryption, we CANNOT recover your password. If you lose your password, your encrypted data will be irretrievably lost.

## 7. Storage Duration

- **Account data:** Until deletion of your account by yourself
- **Encrypted Life Context data:** Until deletion of your account
- **API usage data:** 12 months, then automatic deletion
- **Feedback:** Until deletion of your account (or upon request)
- **Email verification tokens:** 24 hours
- **Password reset tokens:** 1 hour
- **Server logs:** 7 days

## 8. Your Rights

You have the following rights regarding your personal data:

### 8.1 Right to Access (Art. 15 GDPR)
You can request information about your stored personal data.

### 8.2 Right to Rectification (Art. 16 GDPR)
You can request correction of inaccurate data.

### 8.3 Right to Erasure (Art. 17 GDPR)
You can request deletion of your data. You can do this yourself at any time:

**How to delete your account:**
1. Open the menu in the app (☰)
2. Select "Disclaimer"
3. Scroll down to the "Delete Account" section
4. Follow the confirmation instructions

**What will be deleted:**
- All your account data (email, password)
- Your encrypted Life Context
- Gamification data (XP, level, achievements)
- All feedback submitted by you
- API usage data with your user ID

The deletion is **permanent and cannot be undone**.

### 8.4 Right to Data Portability (Art. 20 GDPR)
You have the right to receive your data in a machine-readable format.

**How to export your data:**
1. Open the menu in the app (☰)
2. Select "Export My Data"
3. Click "Export Data Now"
4. Your data will be downloaded as a JSON file

**The export contains:**
- Account information (email, name if provided, registration date, login data)
- Gamification data (XP, level, achievements, streak)
- Encrypted Life Context (only you can decrypt it with your password)
- Your submitted feedback
- Upgrade codes you redeemed
- API usage statistics (last 12 months)

You can also download your **Life Context file** directly in the app at any time.

### 8.5 Right to Object (Art. 21 GDPR)
You can object to the processing of your data.

### 8.6 Right to Complaint
You have the right to lodge a complaint with a data protection supervisory authority.

**Competent supervisory authority in Austria:**
Austrian Data Protection Authority (Österreichische Datenschutzbehörde)
Barichgasse 40-42, 1030 Vienna
Website: https://www.dsb.gv.at/

## 9. Cookies and Local Storage

Our application uses **localStorage** and **sessionStorage** of your browser for technically necessary functions:

- **Authentication:** Storage of login token
- **Language setting:** Your preferred language
- **Guest mode:** Temporary storage of your data (local only, not on server)

This data is stored **exclusively locally** in your browser and is not transmitted to our servers. You can delete this data at any time in your browser settings.

**We do NOT use tracking cookies, marketing cookies, or third-party analytics tools.**

## 10. Guest Mode

In guest mode, your data is processed **exclusively locally** in your browser. No storage occurs on our servers. You are responsible for saving your Life Context file yourself.

In guest mode, the following data is NOT stored:
- No email address
- No account data
- No encrypted Life Context on server

### Message Limit and Spam Prevention

To prevent abuse, guests have a **weekly message limit of 50 messages**. For identification, we use a browser fingerprint generated from the following characteristics:
- Browser version (User-Agent)
- Screen resolution and color depth
- Language settings
- Timezone
- Canvas rendering properties

**Legal basis:** Art. 6 para. 1 lit. f GDPR (legitimate interest in abuse prevention)

**Storage duration:** The browser fingerprint and message count are stored for a maximum of 7 days and then automatically deleted.

**Note:** The fingerprint is used exclusively for spam prevention and is not linked to other data. It does not allow identification of your person.

Only anonymous API usage data (without user attribution) is collected for cost control.

## 11. Deletion of Your Data

You can delete your account at any time in the settings. Upon deletion, the following data will be irretrievably removed:

- Email address and account data
- Encrypted Life Context data
- Gamification data (XP, Level, Achievements)
- All feedback submitted by you
- API usage data with your user ID

**After deletion, NO personal data remains in our database.**

## 12. Changes to Privacy Policy

We reserve the right to adapt this privacy policy to ensure it always complies with current legal requirements or to implement changes to our services. The new privacy policy will apply to your next visit.

---

**Last updated:** November 2025`;

const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
    const { t } = useLocalization();
    const markdownContent = en_markdown;

    return (
        <div className="w-full max-w-4xl mx-auto p-8 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary my-10 animate-fadeIn rounded-lg shadow-lg">
            <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-content-primary uppercase">{t('privacy_policy_title')}</h1>
            </div>

            <div className="prose dark:prose-invert max-w-none text-content-secondary space-y-4 leading-relaxed">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-content-primary mt-8 mb-4 not-prose" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-content-primary mt-6 mb-3 not-prose" {...props} />,
                    }}
                >
                    {markdownContent}
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

export default PrivacyPolicyView;
