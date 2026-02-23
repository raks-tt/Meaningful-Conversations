// This file defines the prompts and schemas used for structured interactions with the Gemini API.

// This schema defines the expected JSON output for the session analysis feature.
const analysisSchema = {
    type: 'OBJECT',
    properties: {
        summary: {
            type: 'STRING',
            description: 'A concise summary (2-4 sentences) of the key insights and breakthroughs the user had during the session. It must be written in the second person (e.g., "You realized...", "You discovered...").'
        },
        updates: {
            type: 'ARRAY',
            description: 'Proposed updates to the user\'s Life Context file. Only suggest updates for significant new information, changed perspectives, or new goals. Do not suggest updates for trivial conversational details.',
            items: {
                type: 'OBJECT',
                properties: {
                    type: {
                        type: 'STRING',
                        description: 'The type of update. Must be one of: "append", "replace_section", or "create_headline".'
                    },
                    headline: {
                        type: 'STRING',
                        description: 'The target headline in the document. For sub-headlines within a Life Domain (like \'Goals\' or \'Challenges\'), you MUST provide the hierarchical path using \'>\' as a separator, like a breadcrumb. Example: \'Career & Work > Goals\' or \'Health & Wellness > Challenges\'. For top-level headlines like \'Core Profile\', just use the headline name.'
                    },
                    content: {
                        type: 'STRING',
                        description: 'The new markdown content to add or replace. Should be concise and written from the user\'s first-person perspective.'
                    }
                },
                required: ['type', 'headline', 'content']
            }
        },
        nextSteps: {
            type: 'ARRAY',
            description: 'A list of concrete, actionable next steps the user explicitly committed to during the conversation.',
            items: {
                type: 'OBJECT',
                properties: {
                    action: {
                        type: 'STRING',
                        description: 'The specific, concise action to be taken.'
                    },
                    deadline: {
                        type: 'STRING',
                        description: 'The deadline for the action in ISO date format YYYY-MM-DD (e.g., "2025-11-20"). Calculate from the current date provided in the prompt.'
                    }
                },
                required: ['action', 'deadline']
            }
        },
        completedSteps: {
            type: 'ARRAY',
            description: 'A list of next steps from the EXISTING Life Context that the user explicitly mentioned as completed, accomplished, or done during this conversation. Extract the exact text from the existing context.',
            items: {
                type: 'STRING',
                description: 'The exact text of a completed step from the existing "Achievable Next Steps" section (e.g., "Talk to my manager about workload (Deadline: 2025-11-15)" or "* Talk to my manager about workload (bis: 2025-11-15)"). Include the entire line as it appears in the context.'
            }
        },
        accomplishedGoals: {
            type: 'ARRAY',
            description: 'A list of goals from the EXISTING Life Context that the user explicitly mentioned as completed, accomplished, achieved, or reached during this conversation. Extract the exact text from the existing context.',
            items: {
                type: 'STRING',
                description: 'The exact text of an accomplished goal from any "Goals" or "Ziele" section in the Life Domains (e.g., "* Get promoted to Senior Developer by end of year" or "* Ein Buch pro Monat lesen"). Include the entire line as it appears in the context.'
            }
        },
        solutionBlockages: {
            type: 'ARRAY',
            description: 'Identify up to 5 potential solution blockages based on the PEP methodology by Dr. Michael Bohne. Identify the specific blockage type, explain why it applies, and provide a direct quote from the user that supports your conclusion.',
            items: {
                type: 'OBJECT',
                properties: {
                    blockage: {
                        type: 'STRING',
                        enum: ['Self-Reproach', 'Blaming Others', 'Expectational Attitudes', 'Age Regression', 'Dysfunctional Loyalties'],
                        description: 'CRITICAL: ONLY use one of these exact 5 PEP blockage types. Do not use any other frameworks like Mental Fitness (no Hyper-Achiever, Avoider, Judge, etc.).'
                    },
                    explanation: {
                        type: 'STRING',
                        description: 'A brief, neutral explanation of why this blockage might apply to the user\'s situation, based on the conversation.'
                    },
                    quote: {
                        type: 'STRING',
                        description: 'A direct, verbatim quote from the user that exemplifies the blockage.'
                    }
                },
                 required: ['blockage', 'explanation', 'quote']
            }
        },
        hasConversationalEnd: {
            type: 'BOOLEAN',
            description: 'Set to true ONLY if the user EXPLICITLY said goodbye or thanked the coach to end the session (e.g., "thank you for the session", "that\'s all for today", "goodbye", "bye", "thanks, that helped"). Set to false if the conversation just stopped without an explicit farewell. Short conversations without a clear goodbye are NOT formal ends.'
        },
        hasAccomplishedGoal: {
            type: 'BOOLEAN',
            description: 'Set to true ONLY if the user explicitly mentioned accomplishing a specific goal that was previously stated in their life context file.'
        }
    },
    required: ['summary', 'updates', 'nextSteps', 'completedSteps', 'accomplishedGoals', 'solutionBlockages', 'hasConversationalEnd', 'hasAccomplishedGoal']
};

const analysisPrompts = {
    schema: analysisSchema,
    en: {
        prompt: ({ conversation, context, docLang, currentDate }) => `
You are an expert life coach reviewing a coaching session transcript. Your task is to analyze the conversation and provide a structured summary in JSON format.

**Today's Date:** ${currentDate}

## Instructions:
1.  **Analyze the Conversation:** Read the entire conversation between the Coach and the User.
2.  **Refer to the Context:** Use the provided "Life Context" file to understand the user's background, goals, and challenges. The context has a clear, domain-oriented structure.
3.  **Extract Key Information:** Identify new insights, proposed changes to the user's context, actionable next steps, and potential psychological blockages.
4.  **CRITICAL: Avoid Duplicates:** Compare the conversation against the EXISTING Life Context. Propose an update ONLY if it contains genuinely new information or a significant change in perspective that is NOT already present in the context file. DO NOT propose updates for information that is merely repeated or rephrased.
5.  **ULTRA-CRITICAL: Hierarchical Targeting:** When proposing an update for a sub-headline (e.g., a **bolded key** like \`**Goals**:\`), you MUST specify its full hierarchical path in the \`headline\` field of your JSON output. Use \` > \` as a separator.
    *   **CORRECT Example:** If a new goal relates to career, the \`headline\` MUST be \`"Career & Work > Goals"\`.
    *   **INCORRECT Example:** Do NOT use just \`"Goals"\`.
    *   For top-level headlines (like \`## Core Profile\`), no path is needed; just use the headline name.
6.  **Update Logic:**
    *   **'Current Situation':** If the user provides a general status update for a domain, propose to 'replace_section' for the corresponding \`**Current Situation**:\` key.
    *   **'Routines', 'Goals', 'Challenges':** If the user mentions a new habit, goal, or challenge, propose to 'append' it as a markdown list item (e.g., "* My new goal is...") to the content of the corresponding key (\`**Routines & Systems**:\`, \`**Goals**:\`, or \`**Challenges**:\`).
    *   **CRITICAL FORMATTING RULE:** When creating a bullet point, NEVER start the text with a bolded headline format like \`* **My New Item**: ...\`. Instead, use a simple bullet point like \`* My New Item: ...\`.
7.  **ULTRA-CRITICAL: ATOMICITY OF UPDATES:** Each object in the \`updates\` array must represent a single, atomic change to one specific sub-headline. You MUST NOT bundle multiple changes into a single update object. For example, if the user discusses a new career goal and a new career challenge, you MUST generate two separate objects in the \`updates\` array: one targeting \`"Career & Work > Goals"\` and another targeting \`"Career & Work > Challenges"\`.
8.  **Format Output:** Your entire output MUST be a single, valid JSON object that adheres to the provided schema. Do not include any text or markdown outside of the JSON structure.
9.  **Output Language Rules:**
    - The content for the 'summary' and 'solutionBlockages' fields MUST be written in English.
    - CRITICAL: The 'content' for each item in the 'updates' array MUST be written in ${docLang === 'de' ? 'German' : 'English'} to match the language of the original document.
    - CRITICAL: The content for the 'nextSteps' array MUST ALSO be written in ${docLang === 'de' ? 'German' : 'English'} to match the language of the original document.
10. **CRITICAL: PEP Framework Only:** You MUST ONLY identify blockages from the 5 PEP categories listed in the schema: Self-Reproach, Blaming Others, Expectational Attitudes, Age Regression, or Dysfunctional Loyalties. DO NOT use concepts from Mental Fitness (e.g., Hyper-Achiever, Avoider, Judge, Controller, Victim, Stickler, Pleaser) or any other psychological framework. If the conversation does not clearly demonstrate one of the 5 PEP blockages, return an empty array for solutionBlockages.
11. **CRITICAL: Deadline Format:** All deadlines in the 'nextSteps' array MUST be in ISO date format (YYYY-MM-DD). Use today's date (${currentDate}) as reference. Examples: "2025-11-20" for a specific date, or calculate relative dates (e.g., if today is 2025-11-17 and user says "by Wednesday", calculate the actual date). NEVER use natural language like "by Friday" or "next week".
12. **CRITICAL: Completed Steps Management:** If the Life Context already contains a section "✅ Achievable Next Steps" or "✅ Realisierbare nächste Schritte", you MUST carefully review it. If the user explicitly mentions during the conversation that they have completed, accomplished, or done any of the existing steps, you MUST add those EXACT step texts (as they appear in the context, including any deadline information) to the 'completedSteps' array. This enables the system to remove completed tasks from the list.
13. **CRITICAL: Accomplished Goals Management:** If the user explicitly mentions that they have completed, accomplished, achieved, or reached any goal that is currently listed in any "Goals" or "Ziele" section within the Life Domains, you MUST add those EXACT goal texts (as they appear in the context) to the 'accomplishedGoals' array. This enables the system to remove accomplished goals from the list. Only include goals that are explicitly mentioned as achieved during this conversation.
14. **CRITICAL: Next Steps Deduplication:** Before adding any item to the 'nextSteps' array, check if a similar action already exists in the "✅ Achievable Next Steps" section of the Life Context. Do NOT propose next steps that duplicate or closely rephrase existing ones.

## Life Context
\`\`\`markdown
${context || 'No context provided.'}
\`\`\`

## Conversation Transcript
\`\`\`
${conversation}
\`\`\`

Now, provide your analysis as a JSON object.`
    }
};

const templates = {
    en: `# My Life Context

## 👤 Core Profile
*High-level, stable information about me.*

**I am...**:
**Country / State**:
**Core Values**:
**General Sentiment**:

---

## 🗺️ Formative life events
*What milestones and events have shaped you?*



---

## 🧭 Life Domains
*The main areas of my life, each with its own goals and challenges.*

### 💼 Career & Work
**Current Situation**:

**Routines & Systems**:

**Goals**:

**Challenges**:

### 💡 Personal Growth & Learning
**Current Situation**:

**Routines & Systems**:

**Goals**:

**Challenges**:

### 👨‍👩‍👧‍👦 Relationships & Social Life
**Current Situation**:

**Routines & Systems**:

**Goals**:

**Challenges**:

### 🌱 Health & Wellness
**Current Situation**:

**Routines & Systems**:

**Goals**:

**Challenges**:

---

## ✅ Achievable Next Steps
*Specific, actionable tasks I have committed to.*

`
};

const getInterviewTemplate = (lang) => {
    return templates.en;
};


const interviewFormattingPrompts = {
    en: {
        prompt: ({ conversation, template }) => `
You are an expert text formatter. Your task is to populate a markdown template based on an interview transcript.

## CRITICAL Instructions:
1.  **Use the Provided Template:** You are given a markdown template. Your output MUST use this exact structure, including all original headlines, labels (e.g., **Current Situation**), and descriptive subtitles.
2.  **Fill in the Blanks:** Read the interview transcript and extract the user's answers. Synthesize their responses into a concise, first-person narrative (using "I", "my", etc.) and place the information after the corresponding label in the template. For fields that expect a list (Goals, Challenges, Next Steps), format the user's points as a markdown bulleted list (e.g., "* First point\n* Second point").
3.  **Keep All Headlines:** You MUST include every single headline and label from the original template in your final output, in the correct order.
4.  **Handle Missing Information:** If a topic was not discussed in the interview, you MUST still include its headline and label from the template, but leave the content area for that specific label empty. Do not write "Not discussed" or make up information.
5.  **Omit the Guide:** The final output must only contain the user's synthesized information within the template structure. Do NOT include any questions, prompts, or conversational filler from the "Guide".
6.  **Formatting:** You MUST ensure there are two newlines (a blank line) after each piece of information you fill in. This is critical for the document's structure.

## TEMPLATE
\`\`\`markdown
${template}
\`\`\`

## INTERVIEW TRANSCRIPT
\`\`\`
${conversation}
\`\`\`

Now, generate the final "Life Context" markdown file by populating the template based on the transcript.`
    }
};

// Schema for transcript evaluation feature
const transcriptEvaluationSchema = {
    type: 'OBJECT',
    properties: {
        summary: {
            type: 'STRING',
            description: 'A concise 2-3 sentence overview of the evaluation findings. Written in second person ("You...").'
        },
        goalAlignment: {
            type: 'OBJECT',
            properties: {
                score: { type: 'INTEGER', description: 'Score from 1 (not aligned) to 5 (fully aligned).' },
                evidence: { type: 'STRING', description: 'Specific quotes or behaviors from the transcript that demonstrate alignment with the stated goal.' },
                gaps: { type: 'STRING', description: 'What was missing or could have been done differently to better achieve the goal.' }
            },
            required: ['score', 'evidence', 'gaps']
        },
        behavioralAlignment: {
            type: 'OBJECT',
            properties: {
                score: { type: 'INTEGER', description: 'Score from 1 (not aligned) to 5 (fully aligned) — how well the user acted according to their personal target.' },
                evidence: { type: 'STRING', description: 'Specific moments in the transcript where the user demonstrated (or failed to demonstrate) their intended personal behavior.' },
                blindspotEvidence: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'Specific moments where known personality blindspots (from personality profile) surfaced in the transcript. Each entry should cite the relevant behavior and which blindspot it relates to.'
                }
            },
            required: ['score', 'evidence', 'blindspotEvidence']
        },
        assumptionCheck: {
            type: 'OBJECT',
            properties: {
                confirmed: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'User assumptions that were confirmed by what happened in the interaction.'
                },
                challenged: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'User assumptions that were contradicted or challenged by the actual interaction.'
                },
                newInsights: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'Unexpected insights or patterns that emerged, which the user did not anticipate.'
                }
            },
            required: ['confirmed', 'challenged', 'newInsights']
        },
        calibration: {
            type: 'OBJECT',
            properties: {
                selfRating: { type: 'INTEGER', description: 'The user\'s self-reported satisfaction rating (1-5), copied from pre-answers.' },
                evidenceRating: { type: 'INTEGER', description: 'AI-assessed effectiveness rating (1-5) based on transcript evidence.' },
                delta: { type: 'STRING', description: 'Description of the gap between self-assessment and evidence (e.g., "You rated yourself 2 points lower than the evidence suggests").' },
                interpretation: { type: 'STRING', description: 'What the gap (or alignment) between self-rating and evidence-rating reveals about the user\'s self-perception. This is where blindspot or confidence insights emerge.' }
            },
            required: ['selfRating', 'evidenceRating', 'delta', 'interpretation']
        },
        personalityInsights: {
            type: 'ARRAY',
            description: 'Personality-specific observations. Only include if a personality profile was provided.',
            items: {
                type: 'OBJECT',
                properties: {
                    dimension: { type: 'STRING', description: 'The personality dimension (e.g., "Riemann: Nähe", "Big5: Extraversion", "SD: Orange").' },
                    observation: { type: 'STRING', description: 'What was observed in the transcript related to this dimension.' },
                    recommendation: { type: 'STRING', description: 'A specific, actionable recommendation for development.' }
                },
                required: ['dimension', 'observation', 'recommendation']
            }
        },
        strengths: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'What went well in the interaction — specific behaviors, communication patterns, or decisions that were effective.'
        },
        developmentAreas: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'What could be improved — specific behaviors, missed opportunities, or patterns to work on.'
        },
        nextSteps: {
            type: 'ARRAY',
            description: 'Concrete, actionable recommendations for the user\'s next interaction or coaching session.',
            items: {
                type: 'OBJECT',
                properties: {
                    action: { type: 'STRING', description: 'A specific action to take.' },
                    rationale: { type: 'STRING', description: 'Why this action matters, linked to the evaluation findings.' }
                },
                required: ['action', 'rationale']
            }
        },
        contextUpdates: {
            type: 'ARRAY',
            description: 'Proposed updates to the user\'s Life Context based on evaluation insights.',
            items: {
                type: 'OBJECT',
                properties: {
                    type: { type: 'STRING', description: 'Update type: "append", "replace_section", or "create_headline".' },
                    headline: { type: 'STRING', description: 'Target headline using hierarchical path (e.g., "Career & Work > Challenges").' },
                    content: { type: 'STRING', description: 'The content to add or replace.' }
                },
                required: ['type', 'headline', 'content']
            }
        },
        botRecommendations: {
            type: 'ARRAY',
            description: 'For each development area, recommend a primary and secondary coaching profile from the available bot catalog. Match the bot\'s specialization to the development need.',
            items: {
                type: 'OBJECT',
                properties: {
                    developmentArea: { type: 'STRING', description: 'The exact development area text this recommendation addresses (must match an entry from developmentAreas).' },
                    primary: {
                        type: 'OBJECT',
                        description: 'The best-fit coaching profile for this development area.',
                        properties: {
                            botId: { type: 'STRING', description: 'The exact bot ID (e.g., "ava-strategic", "chloe-cbt").' },
                            botName: { type: 'STRING', description: 'The display name of the bot (e.g., "Ava", "Chloe").' },
                            rationale: { type: 'STRING', description: 'A 1-2 sentence explanation why this bot is the best fit for the development area.' },
                            examplePrompt: { type: 'STRING', description: 'A concrete, copy-paste-ready conversation starter the user could use to begin a session addressing this development area.' },
                            requiredTier: { type: 'STRING', description: 'The access tier required: "guest", "premium", or "client".' }
                        },
                        required: ['botId', 'botName', 'rationale', 'examplePrompt', 'requiredTier']
                    },
                    secondary: {
                        type: 'OBJECT',
                        description: 'An alternative coaching profile that could also help with this development area, offering a different approach.',
                        properties: {
                            botId: { type: 'STRING', description: 'The exact bot ID (e.g., "nexus-gps", "victor-bowen").' },
                            botName: { type: 'STRING', description: 'The display name of the bot (e.g., "Nobody", "Victor").' },
                            rationale: { type: 'STRING', description: 'A 1-2 sentence explanation why this bot offers a valuable alternative approach.' },
                            examplePrompt: { type: 'STRING', description: 'A concrete, copy-paste-ready conversation starter for this alternative bot.' },
                            requiredTier: { type: 'STRING', description: 'The access tier required: "guest", "premium", or "client".' }
                        },
                        required: ['botId', 'botName', 'rationale', 'examplePrompt', 'requiredTier']
                    }
                },
                required: ['developmentArea', 'primary', 'secondary']
            }
        },
        overallScore: {
            type: 'INTEGER',
            description: 'Overall effectiveness score from 1-10, calculated as: Goal Alignment Score + Behavioral Alignment Score. Example: Goal=4, Behavioral=5 → Overall=9. Do NOT include the user\'s self-rating (satisfaction) in this score.'
        }
    },
    required: ['summary', 'goalAlignment', 'behavioralAlignment', 'assumptionCheck', 'calibration', 'personalityInsights', 'strengths', 'developmentAreas', 'nextSteps', 'botRecommendations', 'contextUpdates', 'overallScore']
};

const transcriptEvaluationPrompts = {
    schema: transcriptEvaluationSchema,
    en: {
        prompt: ({ preAnswers, transcript, personalityProfile, context, docLang, currentDate }) => `
You are an expert communication coach evaluating a real interaction transcript. Your task is to provide a structured, evidence-based evaluation by comparing the user's stated goals and intentions against what actually happened in the interaction.

**Today's Date:** ${currentDate}

## User's Pre-Reflection

Before providing the transcript, the user answered these questions:

**Goal of the interaction:** ${preAnswers.goal}

**Personal target (how they wanted to behave):** ${preAnswers.personalTarget}

**Assumptions and beliefs going in:** ${preAnswers.assumptions}

**Self-rated satisfaction (1-5):** ${preAnswers.satisfaction}
${preAnswers.difficult ? `\n**What was most difficult:** ${preAnswers.difficult}` : ''}

${personalityProfile ? `## Personality Profile Summary
The user has the following personality profile. Use this to identify blindspot evidence and provide personality-aware insights.

${personalityProfile}
` : '## No Personality Profile Available\nProvide general communication insights without personality-specific analysis. Leave personalityInsights as an empty array.'}

${context ? `## Life Context
\`\`\`markdown
${context}
\`\`\`` : '## No Life Context Available'}

## Interaction Transcript
\`\`\`
${transcript}
\`\`\`

## Evaluation Instructions

1. **Goal Alignment (score 1-5):** How well did the actual interaction achieve the user's stated goal? Cite specific transcript moments as evidence. Identify gaps between intention and reality.

2. **Behavioral Alignment (score 1-5):** Did the user act the way they intended to? Reference their "personal target" and compare with actual behavior in the transcript. If a personality profile is available, identify moments where known blindspots surfaced.

3. **Assumption Check:** Sort the user's stated assumptions into confirmed, challenged, or note any unexpected insights that emerged.

4. **Calibration:** Compare the user's self-rating (${preAnswers.satisfaction}/5) with your evidence-based assessment. The delta between self-perception and reality is where the most valuable coaching insight lives. If the user underrates themselves, that reveals a confidence gap. If they overrate themselves, that reveals a blindspot.

5. **Personality Insights:** Only if a profile was provided. Link specific transcript moments to personality dimensions. Be specific — don't just name the dimension, show how it manifested.

6. **Strengths:** What did the user do well? Be specific and cite transcript evidence.

7. **Development Areas:** What could improve? Be constructive and specific.

8. **Next Steps:** Provide 2-4 concrete, actionable recommendations with clear rationale tied to your findings.

9. **Bot Recommendations:** For each development area, recommend a primary and secondary coaching profile from the catalog below. Include the exact botId, a 1-2 sentence rationale why this bot fits, and a concrete example conversation starter the user could copy-paste to begin a session addressing this development area. Ensure the primary and secondary bots are different. Always use the SAME language as the evaluation output for rationale and examplePrompt.

**Available Coaching Profiles:**
- Nobody (nexus-gps, guest): Pragmatic management advisor and communication strategist, GPS method. For: management and communication topics, concrete problem-solving, next steps, conversation preparation.
- Max (max-ambitious, guest): Inspiring, questioning, reflective. For: potential, motivation, new perspectives, confidence.
- Ava (ava-strategic, guest): Strategic, decisive, organized. For: prioritization, planning, complex decisions, organizational topics.
- Kenji (kenji-stoic, premium): Stoic, composed, wise. For: stress, perspective shifts, inner calm, philosophical reflection.
- Chloe (chloe-cbt, premium): Practical, structured, evidence-based. For: thought patterns, behavioral strategies, systematic reflection.
- Rob (rob, client): Mental fitness, empathetic, mindful. For: self-sabotage patterns, emotional resilience, inner blockages.
- Victor (victor-bowen, client): Systemic, analytical, neutral. For: relationship dynamics, conflict patterns, team dynamics, differentiation.

10. **Context Updates:** If the user has a Life Context, propose updates that capture significant new insights from this evaluation. Follow the hierarchical headline format (e.g., "Career & Work > Challenges"). ${docLang === 'de' ? 'Write context updates in German.' : 'Write context updates in English.'}

11. **Overall Score (1-10):** A holistic assessment considering goal alignment, behavioral alignment, strengths, and development areas. **Do NOT consider the user's self-rating (satisfaction) in this score** — that's purely for calibration purposes. Base the overall score on objective evidence from the transcript.

**IMPORTANT: Calculate the overall score as follows:**
- Overall Score = Goal Alignment Score + Behavioral Alignment Score
- Example: Goal=4/5, Behavioral=5/5 → Overall=9/10
- This ensures transparency and traceability for users.

**Output Language:** Write ALL evaluation content in English.
**Tone:** Supportive but honest. Like a trusted coach who respects the user enough to give direct feedback.
**Evidence:** Every claim must be backed by specific transcript references. No vague generalizations.

Provide your evaluation as a JSON object.`
    }
};

module.exports = {
    analysisPrompts,
    interviewFormattingPrompts,
    getInterviewTemplate,
    transcriptEvaluationPrompts,
};
