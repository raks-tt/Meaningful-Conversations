// DPC Strategies - Multilingual
// Dynamic Prompt Controller adaptation strategies for both Riemann-Thomann and Big5

const RIEMANN_STRATEGIES = {
  dauer: {
    high: {
      en: {
        language: 'structured, step-by-step, with clear deadlines',
        tone: 'reassuring, affirming, reliable',
        approach: 'Offer concrete to-do lists, timelines, and security.'
      }
    },
    low: {
      en: {
        blindspot: 'Flexibility, spontaneous adaptation, risk tolerance',
        challenge: 'Specifically challenge them to try something unstructured or uncertain.'
      }
    }
  },
  wechsel: {
    high: {
      en: {
        language: 'dynamic, inspiring, varied',
        tone: 'enthusiastic, energetic, encouraging',
        approach: 'Use metaphors, jump between perspectives, be spontaneous.'
      }
    },
    low: {
      en: {
        blindspot: 'Routine, long-term planning, discipline',
        challenge: 'Challenge them to develop a long-term, structured plan.'
      }
    }
  },
  naehe: {
    high: {
      en: {
        language: 'empathetic, warm, personal',
        tone: 'caring, supportive, committed',
        approach: 'Use "we"-language, ask about feelings, show compassion.'
      }
    },
    low: {
      en: {
        blindspot: 'Emotional boundaries, conflict capability, objective criticism',
        challenge: 'Challenge them to say a clear "no" or maintain objective distance.'
      }
    }
  },
  distanz: {
    high: {
      en: {
        language: 'rational, brief, concise',
        tone: 'objective, factual, direct',
        approach: 'Use data, facts, logical arguments. Avoid excessive emotion.'
      }
    },
    low: {
      en: {
        blindspot: 'Independence, objectivity, emotional self-regulation',
        challenge: 'Challenge them to make a purely rational analysis without emotions.'
      }
    }
  }
};

const BIG5_STRATEGIES = {
  openness: {
    high: {
      en: {
        language: 'abstract, theoretical, visionary',
        tone: 'curious, explorative, philosophical',
        approach: 'Use thought experiments, new perspectives, unconventional solutions.'
      }
    },
    low: {
      en: {
        language: 'concrete, proven, pragmatic',
        tone: 'grounded, reliable, conservative',
        approach: 'Use familiar methods, avoid too much abstraction.',
        blindspot: 'Creativity, willingness to experiment, new perspectives',
        challenge: 'Challenge them to explore a completely unconventional solution or try something new.'
      }
    }
  },
  conscientiousness: {
    high: {
      en: {
        language: 'detailed, structured, planned',
        tone: 'conscientious, precise, reliable',
        approach: 'Use checklists, clear deadlines, measurable goals.'
      }
    },
    low: {
      en: {
        language: 'flexible, spontaneous, experimental',
        tone: 'relaxed, adaptive, improvising',
        approach: 'Allow disorder, accept procrastination, emphasize flexibility.',
        blindspot: 'Structure, self-discipline, perseverance',
        challenge: 'Challenge them to create a concrete plan with milestones and stick to it.'
      }
    }
  },
  extraversion: {
    high: {
      en: {
        language: 'sociable, energetic, expressive',
        tone: 'enthusiastic, motivating, activating',
        approach: 'Suggest social activities, use "you" or "we"-language.'
      }
    },
    low: {
      en: {
        language: 'reserved, reflective, quiet',
        tone: 'thoughtful, contemplative, introspective',
        approach: 'Respect silence, suggest individual reflections.',
        blindspot: 'Visibility, active networking, self-presentation',
        challenge: 'Challenge them to proactively reach out to someone, make themselves visible, or seek feedback.'
      }
    }
  },
  agreeableness: {
    high: {
      en: {
        language: 'cooperative, harmonious, supportive',
        tone: 'friendly, considerate, empathetic',
        approach: 'Emphasize teamwork, consensus, shared solutions.',
        blindspot: 'Asserting own needs, enduring conflict, saying no',
        challenge: 'Challenge them to clearly represent their own interests, even if it feels uncomfortable.'
      }
    },
    low: {
      en: {
        language: 'direct, competitive, critical',
        tone: 'challenging, confrontational, assertive',
        approach: 'Use objective criticism, allow competition.',
        blindspot: 'Empathy, willingness to compromise, team orientation',
        challenge: 'Challenge them to seek a win-win solution or actively gather feedback.'
      }
    }
  },
  neuroticism: {
    low: {
      en: {
        language: 'calm, optimistic, risk-taking',
        tone: 'relaxed, confident, encouraging',
        approach: 'Encourage bold decisions, minimize risk warnings.',
        blindspot: 'Emotional depth, risk sensitivity, caution',
        challenge: 'Challenge them to also reflect on the emotional and risky side of a decision.'
      }
    },
    high: {
      en: {
        language: 'reassuring, structured, security-giving',
        tone: 'empathetic, patient, understanding',
        approach: 'Offer security, acknowledge worries, proceed step-by-step.',
        blindspot: 'Calmness, risk tolerance, letting go of worries',
        challenge: 'Challenge them to take a courageous step despite uncertainty.'
      }
    }
  }
};

// Spiral Dynamics Strategies
// For coaching adaptation based on SD level rankings
const SD_STRATEGIES = {
  beige: {
    high: {
      en: {
        language: 'simple, direct, focused on basic needs',
        tone: 'calming, security-providing, present',
        approach: 'Focus on immediate, practical solutions. Offer stability and security.'
      }
    },
    low: {
      en: {
        blindspot: 'Physical needs, self-care, instincts',
        challenge: 'Pay attention to your physical signals. What does your body need right now?'
      }
    }
  },
  purple: {
    high: {
      en: {
        language: 'communal, tradition-connected, symbolic',
        tone: 'warm, belonging-emphasizing, ritualized',
        approach: 'Emphasize connections to family and community. Use stories and rituals.'
      }
    },
    low: {
      en: {
        blindspot: 'Belonging, traditions, emotional bonds',
        challenge: 'Which traditions or communities could provide you support?'
      }
    }
  },
  red: {
    high: {
      en: {
        language: 'direct, powerful, challenging',
        tone: 'respectfully-confrontational, acknowledging strength',
        approach: 'Address power and assertiveness directly. Offer quick, action-oriented options.'
      }
    },
    low: {
      en: {
        blindspot: 'Assertiveness, self-advocacy, setting boundaries',
        challenge: 'When did you last clearly say no or stand up for yourself?'
      }
    }
  },
  blue: {
    high: {
      en: {
        language: 'structured, principled, order-emphasizing',
        tone: 'reliable, rule-following, ethical',
        approach: 'Offer clear structures, rules, and meaning. Emphasize duty and responsibility.'
      }
    },
    low: {
      en: {
        blindspot: 'Structure, discipline, long-term planning',
        challenge: 'Which rules or principles could give you guidance?'
      }
    }
  },
  orange: {
    high: {
      en: {
        language: 'success-oriented, strategic, results-focused',
        tone: 'motivating, competitive, acknowledging',
        approach: 'Focus on measurable results and efficiency. Offer strategies for goal achievement.'
      }
    },
    low: {
      en: {
        blindspot: 'Ambition, achievement, strategic thinking',
        challenge: 'What goal would you like to achieve? What holds you back?'
      }
    }
  },
  green: {
    high: {
      en: {
        language: 'empathetic, inclusive, consensus-seeking',
        tone: 'understanding, connecting, egalitarian',
        approach: 'Emphasize feelings and relationships. Seek common solutions and harmony.'
      }
    },
    low: {
      en: {
        blindspot: 'Empathy, teamwork, emotional intelligence',
        challenge: 'How do others feel in this situation? What do they need?'
      }
    }
  },
  yellow: {
    high: {
      en: {
        language: 'systemic, integrative, perspective-rich',
        tone: 'curious, flexible, complexity-affirming',
        approach: 'Offer multiple perspectives. Encourage systems thinking and embracing complexity.'
      }
    },
    low: {
      en: {
        blindspot: 'Systems thinking, perspective-taking, complexity tolerance',
        challenge: 'What other viewpoints might apply to this situation?'
      }
    }
  },
  turquoise: {
    high: {
      en: {
        language: 'holistic, connecting, transpersonal',
        tone: 'spiritual, mindful, globally thinking',
        approach: 'Connect personal goals with larger contexts. Emphasize connection with everything.'
      }
    },
    low: {
      en: {
        blindspot: 'Holistic awareness, global perspective, spirituality',
        challenge: 'How does this situation fit into the bigger picture of your life?'
      }
    }
  }
};

// Challenge Examples - Concrete questions/prompts for each blindspot type
// These help coaches formulate effective challenges
const CHALLENGE_EXAMPLES = {
  // Riemann blindspots
  dauer: {
    en: [
      'What if you spent a day this week completely without a plan?',
      'How does it feel when I say: "Let\'s decide this spontaneously"?',
      'What opportunity might be hidden in this uncertainty?'
    ]
  },
  wechsel: {
    en: [
      'What if you created a 90-day plan for this goal?',
      'What routine could give you stability here?',
      'What would happen if you focused on just ONE thing for 3 months?'
    ]
  },
  naehe: {
    en: [
      'When did you last say a clear "no" even though it was uncomfortable?',
      'What do YOU need in this situation - independent of others?',
      'How would it feel to respond matter-of-factly instead of emotionally here?'
    ]
  },
  distanz: {
    en: [
      'What are you feeling right now as you talk about this?',
      'When did you last truly open up to someone?',
      'What would happen if you went from head to heart here?'
    ]
  },
  // Big5 blindspots (using trait names)
  openness_low: {
    en: [
      'What would be the craziest solution to this problem?',
      'What completely different perspective might be helpful here?',
      'What would someone do who has no fear of the unknown?'
    ]
  },
  conscientiousness_low: {
    en: [
      'What would be a small first step you could take TODAY?',
      'What would a concrete weekly plan for this goal look like?',
      'What\'s holding you back from finally completing this?'
    ]
  },
  extraversion_low: {
    en: [
      'Who could you proactively ask for feedback this week?',
      'How could you make your ideas more visible?',
      'What would happen if you showed yourself more on this topic?'
    ]
  },
  agreeableness_high: {
    en: [
      'What is YOUR interest in this situation - honestly?',
      'When did you last endure a conflict instead of giving in?',
      'What would you say if you weren\'t afraid of disappointing others?'
    ]
  },
  agreeableness_low: {
    en: [
      'How might the other person feel in this situation?',
      'What would be a solution that benefits everyone?',
      'When did you last really listen without judging?'
    ]
  },
  neuroticism_high: {
    en: [
      'What\'s the worst that could happen - and how likely is that really?',
      'What would you do if you knew you couldn\'t fail?',
      'What courageous step could you take despite your concerns?'
    ]
  },
  neuroticism_low: {
    en: [
      'What risks might you be overlooking?',
      'What could go wrong that you haven\'t considered?',
      'How would someone feel who is worried in your situation?'
    ]
  }
};

module.exports = {
  RIEMANN_STRATEGIES,
  BIG5_STRATEGIES,
  SD_STRATEGIES,
  CHALLENGE_EXAMPLES
};
