import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { useLocalization } from '../context/LocalizationContext';

interface InfoViewProps {
}

const en_markdown = `<details>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">📖 Introduction</summary>
<div style="padding: 16px;">

Welcome to Meaningful Conversations! This guide will walk you through the app step-by-step. The core concept is your **Life Context** file—a private document that acts as your coach's memory. By updating it after each session, you ensure your coaching is continuous and contextual.

</div>
</details>

---

<details open>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">📚 Chapter 1: Getting Started</summary>
<div style="padding: 16px;">

When you first open the app, you'll have a choice of how to begin.

### 1.1 Guest vs. Registered User
- **Continue as Guest:** Perfect for trying the app. All your data is processed only in your browser. **Important:** You must manually download your Life Context file at the end of each session to save your progress.
- **Register/Login:** Create a free account to save your progress automatically. Your Life Context is stored securely in the cloud with end-to-end encryption.

### 1.2 Creating Your First Life Context
After making your choice, you'll arrive at the landing page with three options:

- **Option A: Create with a Questionnaire**
  - **If you click "Create a New Life Context File,"** you'll be taken to a guided questionnaire.
  - Fill out the fields about your background, goals, and challenges. Only your name is a required field. Optionally, you can specify your **Country / State** (e.g., "Austria - Vienna") to receive local support resources if needed.
  - **When you click "Generate File & Continue,"** your Life Context will be formatted, and you'll proceed to coach selection.

- **Option B: Create with an Interview**
  - **If you click "Start with an interview,"** you'll begin a conversation with Gloria, our guide.
  - She is **not** a coach; she simply asks you the questions from the questionnaire in a natural, conversational way.
  - At the end of the conversation, she will automatically format your answers into a Life Context file.

- **Option C: Upload an Existing File**
  - **If you click the upload area (or drag and drop a file),** you can select a \`.md\` file from your device. This is the method guest users will use to continue their progress from a previous session.

### 1.3 Starting a New Session (for Returning Users)
If you are a registered user returning with a saved context, you will see the **Context Choice** screen.
- **Continue with Saved Context:** Loads your last state and takes you to coach selection.
- **Start a New Session:** Allows you to begin fresh with a blank context (great for exploring a completely new topic).

</div>
</details>

---

<details>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">🔒 Chapter 2: Privacy & Security for Registered Users</summary>
<div style="padding: 16px;">

Your privacy is critical. We use **End-to-End Encryption (E2EE)** for your Life Context file and your Personality Profile.

- Your password generates a unique encryption key **on your device**.
- This key is **never** sent to our servers.
- Only the encrypted, unreadable version of your data is stored.
- **No one but you can read your data.**

### 2.1 Account Management

Via the menu (☰), you can access **Account Management** with the following options:

- **Edit Profile:** Change your name and email address.
- **Change Password:** Update your password. **Note:** Since your password generates the encryption key, your encrypted data (Life Context, Personality Profile) is automatically re-encrypted with the new key.
- **Export Data (GDPR):** Download all your stored data -- as an HTML report or JSON file. The export includes: account data, gamification progress, Life Context, Personality Profile, session ratings, redeemed codes, and usage statistics.
- **Redeem Code:** Enter an access code to upgrade your access tier (e.g., Premium or Client).
- **Delete Account:** Permanently and irreversibly deletes your account and all associated data from our servers.

</div>
</details>

---

<details>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">📱 Chapter 3: Adding the App to Your Home Screen</summary>
<div style="padding: 16px;">

The Meaningful Conversations app is a Progressive Web App (PWA) and can be installed like a native app on your device. This gives you quick access and an app-like experience.

### 3.1 Installation on iOS (iPhone/iPad)

1. Open the app in **Safari** (important: must be Safari, Chrome won't work).
2. Tap the **Share icon** (the square with an arrow pointing up) in the bottom bar.
3. Scroll down and tap **"Add to Home Screen"**.
4. Give the app a name (e.g., "Meaningful Conversations") and tap **"Add"**.
5. The app will now appear as an icon on your home screen and open in full-screen mode without the browser bar.

### 3.2 Installation on Android

1. Open the app in **Chrome** or another browser.
2. Tap the **Menu icon** (three dots) in the top right.
3. Select **"Add to Home Screen"** or **"Install App"**.
4. Confirm with **"Add"** or **"Install"**.
5. The app will now appear as an icon on your home screen.

### 3.3 Installation on Desktop (Windows/Mac/Linux)

1. Open the app in **Chrome**, **Edge**, or another supported browser.
2. Click the **Install icon** (⊕) in the address bar or the **Menu** (three dots).
3. Select **"Install"** or **"Install App"**.
4. The app will be installed like a desktop application and can be opened from your Start menu/Dock.

**Benefits of Installation:**
- Faster access via your app icon
- Full-screen view without browser chrome
- Push notifications (if enabled)
- Works partially offline

</div>
</details>

---

<details>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">🧠 Chapter 4: Personality Profile for Registered Users</summary>
<div style="padding: 16px;">

This feature is exclusively available to registered users and enables a personalized coaching experience.

### 4.1 Overview

The Personality Profile is an encrypted document that captures your personality traits. It is used to:
- Unlock **coaching modes** for personalized coaching with all coaches
- Generate an individual **Personality Signature**
- Better tailor coaching to your needs

**Access:** Open the menu (☰) and select **"Personality Profile"**.

### 4.2 The Personality Tests

You can choose from three methods proven in coaching. Each illuminates a different aspect of your personality:

**Spiral Dynamics -- "What Drives You" (Recommended)**
Spiral Dynamics captures your value systems and inner driving forces across eight levels:
- Two perspectives: **Self-oriented** (Autonomy & Self-actualization) and **Community-oriented** (Belonging & Connection)
- 8 levels: Survival, Belonging, Power, Order, Achievement, Community, Integration, Holism
- Result: Bar chart showing your scores (1-5) per level
- Quick to complete (approx. 5 minutes)
- Ideal as a first test for a broad understanding of your motivations

<details>
<summary>ℹ️ About the Spiral Dynamics Model</summary>
<div style="padding: 12px 16px;">

**Spiral Dynamics** is a model of human development that describes how value systems and worldviews unfold over the course of a lifetime -- and over the course of human history. It originated with American developmental psychologist **Clare W. Graves** and was popularized by **Don Edward Beck** and **Christopher Cowan** under the name "Spiral Dynamics."

**Core idea:** People don't develop their value systems randomly. They emerge as responses to the life conditions they face. When conditions change, value systems can evolve -- in a predictable sequence that resembles a spiral: each new level integrates the previous ones and adds new capabilities.

**Two Tiers:**
- **1st Tier** (Beige through Green): Each level considers its own worldview to be the only correct one. An achievement-oriented person (Orange) may not understand why someone values tradition and order (Blue) so highly -- and vice versa.
- **2nd Tier** (Yellow, Turquoise): These levels recognize the value of *all* previous levels. They understand that different situations require different value systems and can flexibly switch between perspectives.

**The eight levels:**
| Color | Core Theme | Self/Community |
|---|---|---|
| **Beige** | Survival, basic physiological needs | Self |
| **Purple** | Belonging, rituals, tribal community | Community |
| **Red** | Power, assertion, self-expression | Self |
| **Blue** | Order, duty, morality, tradition | Community |
| **Orange** | Achievement, success, rationality, innovation | Self |
| **Green** | Community, equality, empathy, consensus | Community |
| **Yellow** | Integration, systems thinking, flexibility | Self |
| **Turquoise** | Holism, global consciousness | Community |

**Important note on measurement:** In this app, we use the **PVQ-21 (Portrait Values Questionnaire)** by Shalom Schwartz, whose results are mapped to Spiral Dynamics color levels. The PVQ-21 measures value priorities -- not developmental stages in the strict sense. The mapping to SD colors is a well-established but simplified approximation. A full Spiral Dynamics assessment would require in-depth interviews or specialized instruments.

**Sources:**
- Graves, C.W. (1970). *Levels of Existence: An Open System Theory of Values.* Journal of Humanistic Psychology.
- Beck, D.E. & Cowan, C.C. (1996). *Spiral Dynamics: Mastering Values, Leadership, and Change.* Blackwell Publishing.
- Schwartz, S.H. (2003). *A Proposal for Measuring Value Orientations across Nations.* ESS Questionnaire Development Report.

</div>
</details>

**OCEAN Test (Big Five):**
OCEAN is an acronym for the five scientifically validated personality dimensions:
- **O**penness - Curiosity and creativity
- **C**onscientiousness - Organization and goal-orientation
- **E**xtraversion - Sociability and energy
- **A**greeableness - Cooperation and empathy
- **N**euroticism / Emotional Stability - Stress resilience

The OCEAN model is the most extensively researched personality model worldwide.
- Quicker to complete (approx. 5 minutes)
- Ideal for an initial overview of your personality structure

<details>
<summary>ℹ️ About the OCEAN Model</summary>
<div style="padding: 12px 16px;">

The **Big Five model** (also known as OCEAN) is the most scientifically validated personality model in modern psychology. It didn't emerge from a single theory but from decades of empirical research known as the **lexical approach**.

**Core idea:** If a personality trait truly matters to people, a word for it exists in everyday language. Researchers systematically analyzed thousands of trait-describing adjectives across languages and consistently found the same five overarching factors -- regardless of culture, language, or era.

**Key milestones:**
- **1930s-1960s:** Gordon Allport, Raymond Cattell, and others collected and categorized personality-describing adjectives
- **1961:** Ernest Tupes and Raymond Christal first identified five recurring factors through factor analysis
- **1980s-1990s:** Lewis Goldberg coined "Big Five"; Paul Costa and Robert McCrae developed the NEO-PI-R, the first standardized Big Five questionnaire
- **2017:** Christopher Soto and Oliver John published the **BFI-2** -- the most modern version, which we use in this app

**Why exactly five factors?** Statistical analysis of large datasets consistently yields a five-factor solution. Fewer factors lose important nuances; more factors become unstable and culture-dependent. Five is the robust "sweet spot" of personality description.

**What the model can do -- and what it can't:** The Big Five describe *tendencies*, not fixed types. Everyone has scores on all five dimensions. The model doesn't say *why* you are the way you are (genes, upbringing, and experience all play a role), but rather maps *how* you typically think, feel, and act. The dimensions are relatively stable over time but can shift through formative life experiences.

**Sources:**
- Soto, C.J. & John, O.P. (2017). *Short and extra-short forms of the Big Five Inventory–2.* Journal of Research in Personality, 68, 69-81.
- Goldberg, L.R. (1993). *The structure of phenotypic personality traits.* American Psychologist, 48(1), 26-34.

</div>
</details>

**Riemann-Thomann Test:**
- Captures your basic drives: Proximity, Distance, Permanence, and Change
- Distinguishes between professional, private context, and self-image
- Shows your stress reaction pattern
- More comprehensive and detailed (approx. 10 minutes)

**Coaching Note:** When DPC or DPFL is activated, the coach uses your **self-image profile** as the basis for conversation adaptation. Reason: In coaching, you show up as "yourself" — not in a professional role or intimate relationship. Your self-image therefore provides the most authentic foundation for personalized coaching. DPFL refinement only adjusts the **self-image** context; Work and Private remain unchanged.

<details>
<summary>ℹ️ About the Riemann-Thomann Model</summary>
<div style="padding: 12px 16px;">

The **Riemann-Thomann model** combines depth-psychological insights with systemic counseling practice. It was developed by Swiss psychologist and communication consultant **Christoph Thomann**, building on the work of psychoanalyst **Fritz Riemann**.

**Origin:** In his influential work *Grundformen der Angst* (Basic Forms of Anxiety, 1961), Fritz Riemann described four existential core anxieties that shape human experience: the fear of intimacy (loss of self), of individuation (isolation), of change (uncertainty), and of permanence (rigidity). Christoph Thomann transformed these depth-psychological polarities into a practical counseling model with two bipolar axes.

**The Riemann Cross:** The four basic drives are arranged as two axes:
- **Proximity ↔ Distance:** The tension between the desire for closeness and the need for independence
- **Permanence ↔ Change:** The tension between the desire for stability and the need for novelty

Everyone carries elements of all four drives -- the individual mix creates the personal profile. There is no "better" or "worse"; each position has its strengths and challenges.

**What makes this model special:** Unlike many personality models, Riemann-Thomann explicitly accounts for the fact that people behave **differently depending on context**. At work, we often show different drives than in private life or in our self-perception. This differentiation makes the model particularly valuable for understanding relationship dynamics.

**Stress behavior:** Under pressure, dominant drives tend to intensify -- a strongly proximity-oriented person may become even more clingy under stress, while a distance-oriented person may withdraw further. Recognizing these patterns is an important step toward self-regulation.

**Sources:**
- Riemann, F. (1961). *Grundformen der Angst.* Ernst Reinhardt Verlag.
- Thomann, C. & Schulz von Thun, F. (1988). *Klärungshilfe 1.* Rowohlt.

</div>
</details>

**Note:** After completing your first test, you can take additional tests at any time to enrich your profile with additional perspectives.

### 4.3 The Personality Signature

After the test, you can answer two **"Golden Questions"**:
- **Flow Experience:** A situation where you felt completely in your element
- **Conflict Experience:** A situation that cost you an unusual amount of energy

Based on your test results and these stories, our AI generates a unique **Personality Signature** with:
- 🧬 **Your Signature:** A concise description of your "operating system"
- ⚡ **Secret Superpowers:** Your hidden strengths
- ⚪ **Potential Blindspots:** Areas that deserve attention
- 🌱 **Growth Opportunities:** Concrete development recommendations

**Note:** The signature can be collapsed. To update it, collapse and expand it again – this prevents accidental regeneration.

### 4.4 Adaptive vs. Stable Profile

At the end of the test, you choose how your profile should evolve:

**📊 Adaptive Profile:**
- Learns from your coaching sessions
- Refines itself automatically over time
- After each session, you'll be asked how authentic you were. Profile adjustments are only suggested after at least two authentic sessions.
- Ideal for: Self-discovery & continuous growth

**🔒 Stable Profile:**
- Remains unchanged until the next manual evaluation
- You keep full control over changes
- Ideal for: Clear baseline & targeted comparisons

**Warning:** For an adaptive profile with existing refinements, you'll receive a warning when starting a new test that all previous adaptations will be overwritten.

### 4.5 Coaching Modes

With a personality profile, you can choose between three coaching modes:

**Off (Default):**
- Classic coaching without personalization
- Your profile is not used

**DPC (Dynamic Personality Coaching):**
- Your profile is used during sessions
- The coach adapts their style to your personality
- The profile is **not** modified

**DPFL (Dynamic Personality-Focused Learning):**
- Your profile is used AND can be fully refined from the **second session** onwards
- The coach suggests profile adjustments based on the conversation
- Requires an **adaptive profile**

**Switching Modes:** You can change the mode at any time in your personality profile. Collected refinements are preserved.

**Display:** The active coaching mode is shown in the **Coach Info Modal** (click on the coach's name in the chat).

### 4.6 Personalized Coaching

With an active personality profile, coaching is tailored to you with **all coaches**:
- Every coach adapts their communication style to your personality traits
- Conversation guidance considers your preferred way of communicating
- With an adaptive profile, coaches continuously suggest adjustments to your personality profile based on conversation insights. This way, coaches provide "external perspective" feedback that optimally complements your "self-image".
- In DPC/DPFL mode, coaches actively use your **Personality Signature**: They recognize when challenges can be addressed with your **strengths**, and gently point out **potential blind spots** - especially for motivation and relationship topics.

</div>
</details>

---

<details>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">💬 Chapter 5: The Coaching Session</summary>
<div style="padding: 16px;">

### 5.1 Choosing Your Coach
On the **Select a Coach** screen, you'll see a list of available coaches. Each coach has a unique approach suited for different situations. **Click on a coach card** to start your session immediately.

**Your Guide:**
- **Nobody** -- Your pragmatic sparring partner for management and communication topics

**Your Interviewer:**
- **Gloria** -- Professional interviewer for structured conversations about ideas, projects, and workflows (Registered)

**Your Coaches:**
- **Max** -- Motivational coach who helps you think bigger and unlock your potential
- **Ava** -- Strategic advisor for decision-making and priority management
- **Kenji** -- Stoic philosopher for resilience and inner strength (Premium)
- **Chloe** -- Structured reflection for recognizing thought patterns (Premium)
- **Rob** -- Mental fitness and mindfulness against self-sabotage (Client)
- **Victor** -- Systemic coach for relationship patterns and response differentiation (Client)

Some coaches are marked with a lock icon and require a premium or client subscription. Coaches with a 🔔 icon offer **guided meditation exercises** during the session.

**Click on a name to learn more:**

<details>
<summary>Nobody -- Efficient, Adaptive, Solution-Focused</summary>
<div style="padding: 12px 16px;">

**Core Idea:** Nobody is not a coach in the classical sense -- he is your pragmatic sparring partner for management and communication topics. He uses the GPS approach (Goal-Problem-Solution) and adapts his style situationally: from targeted questions to concrete tips when you are stuck.

**Ideal for:**
- When dealing with spontaneous everyday and communication topics
- Concrete strategies and next steps
- Quick, goal-oriented reflection
- Time-efficient sessions with clear outcomes

**Example Situations:** "I have a specific problem and need to define my next steps." / "I want to prepare for a conversation." / "I need someone to help me efficiently reflect on a situation I experienced."

**Access:** Free for all users
</div>
</details>

<details>
<summary>Gloria -- Structured, Inquisitive, Focused (Registered)</summary>
<div style="padding: 12px 16px;">

**Core Idea:** Gloria is a professional interviewer -- not a coach. She conducts structured interviews that help you articulate and think through your ideas, projects, workflows, or concepts through targeted questions.

**How It Works:**
1. **Setup:** Gloria asks one question at a time about the topic, planned duration, and any special perspectives (e.g., "Interview me as a potential investor").
2. **Confirmation:** She summarizes the assignment in first person before starting the interview.
3. **Interview:** Systematic exploration of the topic with one question per message, follow-ups on interesting points, and periodic summaries.
4. **Conclusion:** At the end of the session, you receive an **Interview Review** with three sections:
   - **Summary** -- Key insights at a glance
   - **Interview Setup** -- Overview of the agreed parameters (topic, duration, perspective)
   - **Smoothed Interview** -- The complete transcript, linguistically cleaned up and clearly formatted

**Export:** All sections can be copied individually or downloaded as a complete Markdown file (.md).

**Adjustable:** You can ask Gloria to change the pace, answer length, or number of questions per message.

**Ideal for:**
- Structuring and articulating ideas
- Examining projects or concepts from different perspectives
- Creating a documented interview as a basis for texts, presentations, or decisions
- Describing and questioning workflows and processes

**Example Situations:** "I want to examine my app idea from an investor's perspective." / "Interview me about my project concept for a presentation." / "I want to describe a workflow and uncover weak points."

**Access:** Registered users
</div>
</details>

<details>
<summary>Max -- Motivating, Curious, Reflective</summary>
<div style="padding: 12px 16px;">

**Core Idea:** Max helps you think bigger by asking the right questions to unlock your potential.

**Ideal for:**
- Career goals and professional development
- Personal growth and building confidence
- When you need motivation and a fresh perspective
- Embracing challenges and expanding your boundaries

**Example Situations:** "I want to change careers but don't know where to go." / "I feel stuck and need new impulses." / "I want to start a project but have doubts."

**Access:** Free for all users
</div>
</details>

<details>
<summary>Ava -- Strategic, Long-term, Analytical</summary>
<div style="padding: 12px 16px;">

**Core Idea:** Ava specializes in strategic thinking and helps you see the bigger picture and clearly organize your priorities.

**Ideal for:**
- Business decisions and organizational planning
- Prioritizing when facing too many options
- Long-term life and career planning
- Complex decisions with multiple influencing factors

**Example Situations:** "I need to make a difficult business decision." / "I have too many projects and don't know what to prioritize." / "I want to strategically plan my next 5 years."

**Access:** Free for all users
</div>
</details>

<details>
<summary>Kenji -- Composed, Philosophical, Wise (Premium) 🔔</summary>
<div style="padding: 12px 16px;">

**Core Idea:** Kenji is grounded in Stoic philosophy and helps you build resilience by focusing on what you can control.

**Ideal for:**
- Dealing with stress, uncertainty, and change
- Shifting perspective on difficult situations
- Building inner calm and equanimity
- Philosophical reflection on life questions

**Special Feature:** Kenji offers **guided meditation exercises** (🔔). Simply ask him for a meditation -- he will guide you through a Stoic-inspired practice.

**Example Situations:** "I worry about things I can't control." / "I need inner calm during a stressful period." / "I'd like to do a meditation."

**Access:** Premium users
</div>
</details>

<details>
<summary>Chloe -- Reflective, Structured, Evidence-Based (Premium) 🔔</summary>
<div style="padding: 12px 16px;">

**Core Idea:** Chloe uses structured reflection techniques to help you recognize unhelpful thought patterns and develop new behavioral strategies.

**Ideal for:**
- Recognizing and challenging negative thought patterns
- Developing new behavioral strategies
- Structured self-reflection with a clear framework
- Tackling emotional challenges systematically

**Special Feature:** Chloe offers **guided meditation exercises** (🔔), specifically designed for mindful self-reflection.

**Example Situations:** "I always assume the worst and want to change that." / "I want to understand why I always react the same way in certain situations." / "I need a structured approach for my challenge."

**Access:** Premium users
</div>
</details>

<details>
<summary>Rob -- Mental Fitness, Empathetic, Mindful (Client) 🔔</summary>
<div style="padding: 12px 16px;">

**Core Idea:** Rob helps you build mental fitness and resilience by recognizing and overcoming self-sabotaging patterns.

**Ideal for:**
- Recognizing and breaking self-sabotage patterns
- Building mental strength and emotional resilience
- Integrating mindfulness into daily life
- Deep reflection on inner blockages

**Special Feature:** Rob offers **guided meditation exercises** (🔔), focused on mental fitness and mindfulness.

**Example Situations:** "I sabotage myself and don't know why." / "I want to become mentally stronger." / "I'd like to do a mindfulness exercise."

**Access:** Client users
</div>
</details>

<details>
<summary>Victor -- Systemic, Analytical, Neutral (Client)</summary>
<div style="padding: 12px 16px;">

**Core Idea:** Victor is inspired by family systems theory concepts and helps you recognize relationship patterns and develop more differentiated responses.

**Ideal for:**
- Understanding relationship dynamics (family, partner, colleagues)
- Reducing emotional reactivity in relationships
- Recognizing your patterns in recurring conflicts
- Differentiation of self -- developing a clear "I" within relationships

**Example Situations:** "I always end up in the same conflicts at family gatherings." / "I want to understand why certain relationships trigger me so much." / "I want to learn to stay calmer in conflicts."

**Access:** Client users
</div>
</details>

### 5.2 The Chat Interface
- **Header:** At the top, you'll see the coach's name and avatar. **Clicking this area** opens a modal with detailed information about the coach's style and methodology. If you have a coaching mode (DPC/DPFL) activated, it will also be displayed here. On the right is the red **End Session** button.
- **Text Mode (Default):**
  - Type your message in the text area at the bottom.
  - **Click the paper plane icon** to send your message.
  - **Click the microphone icon** to use your browser's speech-to-text feature and dictate your message.
- **Voice Output (TTS) Controls:**
  - **Click the Speaker icon** to toggle text-to-speech on or off.
  - When enabled, you can control playback with the **Pause/Play** and **Repeat** icons.
  - **Click the Gear icon** to open the **Voice Settings** modal. You have the following options:
    - **Coach Signature Voice:** The best available voice for the coach's language and personality -- automatically selected.
    - **Device Voices:** Voices generated directly on your device. **Advantage:** Instant response times and work offline.
    - **Server Voices:** *(Web browser only)* Professional voices generated on our server.
  - **Note for iOS App:** The iOS app exclusively uses high-quality Apple device voices (Enhanced/Premium). These offer excellent quality with instant response times -- server voices are not available or needed here.
- **Voice Mode:**
  - **Click the Sound Wave icon** to switch to the pure voice mode, which is optimized for a more natural conversational experience.
  - **Tap the large microphone icon** to start recording. Speak your message.
  - **Tap the icon again (now a paper plane)** to stop recording and send your message. The coach's reply will play automatically.

</div>
</details>

---

<details>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">🔍 Chapter 6: After the Session - The Review Process</summary>
<div style="padding: 16px;">

### 6.1 The Analysis
**When you click "End Session,"** an AI analyzes your conversation. You will see a loading screen titled **Analyzing Session...**. This process usually takes about 15-30 seconds.

### 6.2 The Session Review Screen
This is the most important screen for capturing your insights.

- **New Findings:** An AI-generated summary of your key takeaways from the session.
- **Rate Your Session:** Use the stars to provide feedback. This helps us improve coach quality.
- **Accomplished Goals:** ⭐ The AI automatically detects when you've achieved a goal from your Life Context. Accomplished goals are marked with ✅ and automatically removed from your Life Context when you accept the updates. This keeps your goal list current and focused.
- **Completed Steps:** Next steps from previous sessions that you've completed are also detected and automatically removed from the list when you accept the updates.
- **Actionable Next Steps:** A list of concrete tasks you committed to during the conversation.
  - **Calendar Integration:** **Click the calendar icon** next to any individual step to export it as a .ics file and import it into your calendar app (Google Calendar, Outlook, Apple Calendar, etc.).
  - **Export All:** **Click "Export All to Calendar"** to export all next steps at once.
  - Calendar events are created by default at 9:00 AM on the deadline date and include a reminder 24 hours before.
- **Proposed Context Updates:** The AI suggests changes to your Life Context file based on the conversation.
  - **Toggle:** Use the checkboxes to select which changes you want to apply.
  - **Change Action Type:** You can change whether a suggestion should **Append** to a section or **Replace** the entire section.
  - **Change Target:** You can change the target headline for any suggestion, including creating new sections.
- **Difference View:** This box shows you the exact changes (red for removed, green for added) that will be applied to your file.
- **Final Context:** **Click "Show / Edit"** to see the full text of your new Life Context file and make any manual edits.
- **Download Transcript & Summary:**
  - **Download Transcript:** Saves the full chat history with timestamps as a \`.txt\` file.
  - **Download Summary:** Saves the AI-generated summary and analysis as a text file.
- **Saving & Continuing:**
  - **Download Context (Backup):** **This is essential for guest users!** Click this to save your updated \`.md\` file. Registered users can use this as a backup.
  - **Continue with [Coach]:** Saves the changes and starts a new session with the same coach.
  - **Switch Coach:** Saves the changes and takes you back to the coach selection screen.
  - **(Registered Users Only) "Don't save text changes...":** If you check this box, your gamification progress will be saved, but the text changes to your Life Context will be discarded.

### 6.3 Authenticity Check & Profile Refinement (DPFL Mode)

If you have the **DPFL coaching mode** activated (see Chapter 4), two additional steps appear after the session:

- **Authenticity Check (Comfort Check):** You'll be asked how authentic you felt during the session (scale 1-5). Only sessions rated 3 or higher are used for profile refinement. This ensures your profile is only adjusted based on authentic interactions.
- **Profile Refinement:** Starting from the **second authentic session**, you'll see a suggestion to adjust your personality profile. You'll see:
  - An analysis of the keywords that led to the suggestions
  - Current vs. suggested values for your personality dimensions
  - You can **accept** or **reject** the suggestions -- you always keep full control

</div>
</details>

---

<details>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">🏆 Chapter 7: Understanding Your Progress (Gamification)</summary>
<div style="padding: 16px;">

The app uses game-like elements to motivate you to engage in regular self-reflection.

### 7.1 The Gamification Bar
At the top of the screen, you will see:
- **Level:** Your overall progress.
- **Streak:** The number of consecutive days you've completed a session.
- **XP Bar:** Shows your progress to the next level.
- **Trophy Icon:** **Click this** to view your **Achievements** page.

### 7.2 How to Earn XP

| Action | XP Awarded |
| :--- | :--- |
| Per message sent in a session | 5 XP |
| Per "Next Step" identified in analysis | 10 XP |
| Accomplishing a pre-existing goal | 25 XP |
| Formally concluding the session | 50 XP |

### 7.3 Where is Progress Saved?

| User Type | Achievement Storage Location | Persistence |
| :--- | :--- | :--- |
| **Registered** | On the server, tied to your account. | **Yes**, across all sessions and devices. |
| **Guest** | In the \`.md\` file in a hidden comment. | **No**, only if you reuse the same file. |

### 7.4 Appearance & Color Scheme

In the Gamification Bar, you'll find two icons to customize the appearance:

- **Light/Dark Mode (Moon/Sun Icon):** Switches between light and dark appearance. By default, the app switches automatically based on the time of day: **Dark mode** from 6:00 PM to 6:00 AM, **Light mode** from 6:00 AM to 6:00 PM. Manually toggling disables the automatic switching.
- **Seasonal Color Scheme (Palette Icon):** Cycles between three color schemes: Summer, Autumn, and Winter. The app automatically selects the matching scheme for the current season, but you can change it manually at any time.

</div>
</details>

---

<details>
<summary style="font-size: 1.25rem; font-weight: 600; cursor: pointer; padding: 12px; background: var(--background-tertiary); border-radius: 8px; margin: 16px 0;">📄 Chapter 8: Transcript Evaluation (Client Feature)</summary>
<div style="padding: 16px;">

### What is Transcript Evaluation?

Transcript Evaluation helps you reflect on real conversations—e.g., with clients, colleagues, or from coaching contexts. You upload a transcript, answer short reflection questions, and receive AI-powered feedback with structured analyses, strengths, and development areas. This lets you learn from every conversation.

### Who Can Use It?

This feature is reserved for **Client users** and is located in the **"Tools"** area on the coach selection screen. It is **available on desktop and tablets**.

### How Does It Work?

**Step 1: Reflection Questions Before Upload**
Answer short questions that prepare you for the conversation—e.g., about context, your goal, or your expectations. This reflection helps the AI tailor the evaluation better to your situation.

**Step 2: Upload Transcript**
Upload your conversation as text or as an SRT file (e.g., from a transcription app). The format should be clearly recognizable (e.g., Speaker: Text).

**Step 3: Detailed Evaluation**
The AI analyzes your conversation and delivers a structured evaluation. You receive ratings, insights, and concrete recommendations (see below).

### What to Expect

The evaluation contains the following components—explained in plain language:

- **Goal Alignment (X/5):** How well was the conversation goal achieved? An assessment of goal attainment.
- **Behavior Analysis (X/5):** How did you behave in the conversation? An analysis of your communication style and behavioral patterns.
- **Assumption Checking:** Which assumptions were verified or confirmed during the conversation?
- **Calibration:** How well did expectations match reality?
- **Strengths & Development Areas:** What went well and where you can develop further?
- **Next Steps:** Concrete recommendations for your next conversation.
- **Recommended Coaching Profiles:** For each identified development area, the AI suggests matching coaching profiles (see below).

**Overall Score:** Goal + Behavior (e.g., 4+5=9/10)

### Recommended Coaching Profiles

At the end of each evaluation, you receive **AI-generated coaching recommendations** for your development areas. For each area, two profiles are suggested:

- **Primary Profile:** The coach best suited for this development area – with a rationale explaining why this coach is a good fit.
- **Alternative Profile:** A second coach offering a complementary perspective on the same topic.

Each recommendation includes:
- **Rationale:** Why this coach is particularly suitable for your development area
- **Conversation Starter:** A concrete example prompt to kick off your first session on this topic (click to copy to clipboard)

**Availability at a Glance:** The recommendation cards use color coding to show whether you have access to each coach:
- 🟢 **Available** – You can use this coach right away
- 🔒 **Premium Required** – This coach requires a Premium access tier
- 🔒 **Client Required** – This coach requires a Client access tier

The recommendations also appear in the **PDF export**, so you can document your development planning.

### Personality Profiles & Personalization

**If you have a Personality Profile**, the AI uses it as well. You will then receive **personality-based insights** tailored to your communication style and personality traits. This helps you understand how your typical patterns showed up in this conversation—and where you can target improvements.

### Additional Features

- **PDF Export** for Clients, Admins, and Developers
- **History view** to review and delete past evaluations

### Privacy

Transcripts are not stored permanently—only the evaluation results are saved.

### How to Get a Transcript

There are several easy ways to create a conversation transcript:

**1. Video Conferencing Tools (easiest method)**
Most modern video conferencing platforms offer built-in transcription:
- **Microsoft Teams:** Enable automatic transcription under *Settings → Meetings*. After the meeting, you'll find the transcript in the chat history.
- **Zoom:** Under *Settings → Recording*, enable "Audio transcript." After recording, a \`.vtt\` file is created.
- **Google Meet:** Select "Start transcription" from the three-dot menu during the meeting. The transcript then appears in Google Docs.

**2. Transcription Apps for In-Person Conversations**
For face-to-face meetings or phone calls:
- **Otter.ai** (iOS/Android/Web): Records and transcribes in real-time. Export as text is available.
- **Apple Devices (iOS 18+ / macOS Sequoia):** The built-in *Notes* app offers a recording feature with automatic transcription.
- **Whisper / MacWhisper** (Desktop): Free, local transcription for audio files directly on your device (no cloud upload needed, particularly privacy-friendly).

**3. Manual Creation**
For short conversations, you can simply write a protocol from memory. Use the format "Speaker: Text" – the AI handles imperfect transcripts quite well.

**⚠️ Important:** You are responsible for ensuring that all conversation participants have consented to recording and analysis. Please observe the applicable laws regarding conversation recording in your country.

### Tips for Best Results

- **Optimal length:** Real conversations of 5–10 minutes with clear structure work best.
- **Clear transcripts:** Make sure speakers and text are clearly identifiable.
- **Provide context:** Use the reflection questions to describe the context and goal of the conversation.
- **Use your Personality Profile:** If you have a profile, enable it—the evaluation will be more personalized.

</div>
</details>
`;

// Fix: Add the component definition and default export.
const UserGuideView: React.FC<InfoViewProps> = () => {
    const { t } = useLocalization();
    const markdownContent = en_markdown;

    return (
        <div className="w-full max-w-4xl mx-auto p-6 space-y-6 bg-background-secondary dark:bg-transparent border border-border-secondary dark:border-border-primary mt-4 mb-10 animate-fadeIn rounded-lg shadow-lg">

            <div className="p-4 mt-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg not-prose">
                <div className="flex items-start gap-3">
                    <div className="text-2xl mt-0.5">⚠️</div>
                    <div>
                        <h3 className="font-bold text-lg text-content-primary">{t('user_guide_attention_title')}</h3>
                        <p className="mt-2 text-sm text-content-secondary" dangerouslySetInnerHTML={{ __html: t('user_guide_attention_guest') }} />
                        <p className="mt-2 text-sm text-content-secondary" dangerouslySetInnerHTML={{ __html: t('user_guide_attention_registered') }} />
                    </div>
                </div>
            </div>

            <div className="prose dark:prose-invert max-w-none text-content-secondary space-y-4 leading-relaxed">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-content-primary mt-8 mb-4 not-prose" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-content-primary mt-6 mb-3 not-prose" {...props} />,
                    }}
                >
                    {markdownContent}
                </ReactMarkdown>
            </div>

        </div>
    );
};

export default UserGuideView;
