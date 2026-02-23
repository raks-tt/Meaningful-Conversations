const Mailjet = require('node-mailjet');

let mailjet;
const isProductionOrStaging = process.env.ENVIRONMENT_TYPE === 'production' || process.env.ENVIRONMENT_TYPE === 'staging';

// Initialize Mailjet client only if necessary credentials are provided
if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
    mailjet = new Mailjet({
        apiKey: process.env.MAILJET_API_KEY,
        apiSecret: process.env.MAILJET_SECRET_KEY
    });
} else {
    if (isProductionOrStaging) {
        console.error("FATAL: Mailjet API keys are not configured for production/staging environment.");
    } else {
        console.log("INFO: Mailjet API keys not found. Email sending will be simulated in the console.");
    }
}

const SENDER_EMAIL = process.env.MAILJET_SENDER_EMAIL || 'noreply@example.com';
const SENDER_NAME = 'Meaningful Conversations | www.manualmode.at';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const sendNewsletterEmail = async (email, subject, content, lang = 'en') => {
    // content should contain: { textBody, htmlBody, unsubscribeToken }

    // Generate unsubscribe link
    const unsubscribeUrl = content.unsubscribeToken
        ? `${FRONTEND_URL}?route=unsubscribe&token=${content.unsubscribeToken}`
        : null;

    const unsubscribeTexts = {
        en: '\n\n---\nDon\'t want to receive further newsletters? Click here to unsubscribe:\n'
    };

    // Append unsubscribe link to text body
    let finalTextBody = content.textBody;
    if (unsubscribeUrl) {
        finalTextBody += unsubscribeTexts[lang] || unsubscribeTexts['en'];
        finalTextBody += unsubscribeUrl;
    }

    // Append unsubscribe link to HTML body
    let finalHtmlBody = content.htmlBody;
    if (unsubscribeUrl) {
        const unsubscribeHtml = `<hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
               <p style="text-align: center; font-size: 12px; color: #6b7280;">
                 Don't want to receive further newsletters?<br>
                 <a href="${unsubscribeUrl}" style="color: #1b7272; text-decoration: underline;">Click here to unsubscribe</a>
               </p>`;
        finalHtmlBody += unsubscribeHtml;
    }
    
    if (!isProductionOrStaging) {
        console.log('\n--- SIMULATED NEWSLETTER ---');
        console.log(`To: ${email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body:\n${finalTextBody}`);
        if (unsubscribeUrl) {
            console.log(`Unsubscribe URL: ${unsubscribeUrl}`);
        }
        console.log('----------------------------\n');
        return;
    }

    if (!mailjet) {
        console.error('Mailjet client is not initialized. Cannot send newsletter.');
        throw new Error('Email service is not configured.');
    }

    const request = mailjet
        .post('send', { 'version': 'v3.1' })
        .request({
            'Messages': [
                {
                    'From': {
                        'Email': SENDER_EMAIL,
                        'Name': SENDER_NAME
                    },
                    'To': [
                        {
                            'Email': email
                        }
                    ],
                    'Subject': subject,
                    'TextPart': finalTextBody,
                    'HTMLPart': finalHtmlBody
                }
            ]
        });

    return request;
};

module.exports = {
    sendNewsletterEmail
};