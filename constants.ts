import { Bot } from './types';

export const BOTS: Bot[] = [
    {
        id: 'gloria-life-context',
        name: 'Gloria',
        description: 'A friendly guide who helps you create your first Life Context file through a simple conversation.',
        avatar: 'https://api.dicebear.com/8.x/micah/svg?seed=Erik&backgroundColor=d1d4f9&hairColor=86efac',
        style: 'Conversational, Structured, Helpful',
    },
    {
        id: 'gloria-interview',
        name: 'Gloria',
        description: 'A professional interviewer who helps you structure and articulate your ideas, projects, and workflows through a focused conversation.',
        avatar: 'https://api.dicebear.com/8.x/micah/svg?seed=Erik&backgroundColor=c0aede&hairColor=86efac',
        style: 'Structured, Inquisitive, Focused',
    },
    {
        id: 'max-ambitious',
        name: 'Max',
        description: 'An inspiring coach who helps you think bigger by asking the right questions to unlock your potential.',
        avatar: 'https://api.dicebear.com/8.x/micah/svg?seed=Elara&backgroundColor=B8D4B8&radius=50&mouth=smile&shirtColor=ffffff',
        style: 'Motivational, Inquisitive, Reflective',
    },
    {
        id: 'ava-strategic',
        name: 'Ava',
        description: 'A coach specializing in strategic thinking and business decision-making to help you see the bigger picture.',
        avatar: 'https://api.dicebear.com/8.x/micah/svg?seed=Sophie&backgroundColor=d1d4f9,c0aede,b6e3f4&radius=50&mouth=smirk,smile&shirtColor=ffffff&hair=full&hairColor=cb682f',
        style: 'Strategic, Long-term, Analytical',
    },
    {
        id: 'kenji-stoic',
        name: 'Kenji',
        description: 'A coach grounded in Stoic philosophy, helping you build resilience for challenges.',
        avatar: 'https://api.dicebear.com/9.x/micah/svg?seed=Kimberly&baseColor=f9c9b6&backgroundColor=FBE870&mouth=smirk',
        style: 'Composed, Philosophical, Wise',
    },
    {
        id: 'chloe-cbt',
        name: 'Chloe',
        description: 'A professional coach using structured reflection techniques to help you recognize unhelpful thought patterns and develop new behavioral strategies.',
        avatar: 'https://api.dicebear.com/8.x/micah/svg?seed=Chloe&backgroundColor=ffdfbf&radius=50&mouth=smile,smirk&shirtColor=ffffff',
        style: 'Reflective, Structured, Evidence-Based',
        // coachingMode wird im Persönlichkeitsprofil eingestellt
    },
    {
        id: 'rob',
        name: 'Rob',
        description: 'An experienced coach helping you build mental fitness and resilience by recognizing self-sabotaging patterns.',
        avatar: 'https://api.dicebear.com/8.x/micah/svg?seed=Rob&backgroundColor=E8E8E8&radius=50&mouth=smile&shirtColor=ffffff',
        style: 'Mental Fitness, Empathetic, Mindful',
    },
    {
        id: 'nexus-gps',
        name: 'Nobody',
        description: 'An efficient manager who helps you find your own solutions - with tips when you need them.',
        avatar: 'https://api.dicebear.com/8.x/micah/svg?seed=Alex&backgroundColor=d1d4f9,c0aede,b6e3f4&radius=50&mouth=smirk&shirtColor=ffffff',
        style: 'Efficient, Adaptive, Solution-Focused',
    },
    {
        id: 'victor-bowen',
        name: 'Victor',
        description: 'A systemic coach inspired by family systems theory concepts, helping you recognize patterns and develop differentiated responses.',
        avatar: 'https://api.dicebear.com/8.x/micah/svg?seed=VictorCoSerious&backgroundColor=ff9999&radius=50&mouth=smirk&shirtColor=ffffff',
        style: 'Systemic, Analytical, Neutral',
    }
];