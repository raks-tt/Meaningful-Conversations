import { User } from '../types';

// Custom error class for API fetch errors.
// This allows other parts of the app to inspect the error details.
export class ApiError extends Error {
    status: number;
    data: any;
    isNetworkError: boolean;
    backendUrl: string;

    constructor(message: string, status: number, data: any, isNetworkError: boolean = false, backendUrl: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
        this.isNetworkError = isNetworkError;
        this.backendUrl = backendUrl;
    }
}


/**
 * Determines the backend API URL at runtime based on the frontend's hostname and port.
 * This allows a single build to be deployed to multiple environments.
 * @returns {string} The base URL for the API.
 */
export const getApiBaseUrl = (): string => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    const urlParams = new URLSearchParams(window.location.search);
    const backendParam = urlParams.get('backend');

    // 0. Capacitor Detection: iOS/Android native apps run in capacitor:// protocol
    // In this environment, 'localhost' refers to the device itself, not the dev machine.
    // Use staging backend for Capacitor testing.
    const isCapacitor = protocol === 'capacitor:' || 
                        (typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.());
    
    if (isCapacitor) {
        // Allow override via URL param even in Capacitor
        if (backendParam === 'production') {
            return 'https://mc-app.manualmode.at';
        }
        // Default to staging for Capacitor testing
        console.log('[API] Capacitor detected, using staging backend');
        return 'https://mc-beta.manualmode.at';
    }

    // 1. Priority: URL parameter for explicit override (for local development/testing)
    if (backendParam === 'local') {
        return 'http://localhost:3001';
    }
    if (backendParam === 'staging') {
        return 'https://mc-beta.manualmode.at';
    }
    if (backendParam === 'production') {
        return 'https://mc-app.manualmode.at';
    }

    // 2. Runtime detection based on hostname and port
    // Include port in the key to distinguish between staging and production on the same server
    const hostnameWithPort = port ? `${hostname}:${port}` : hostname;
    
    const backendMap: { [key: string]: string } = {
        // Manualmode Server Deployment (Podman-based with nginx reverse proxy)
        // Uses relative paths - nginx on host handles /api routing to backend containers
        'mc-beta.manualmode.at': '',   // Staging: nginx proxies /api to backend pod
        'mc-app.manualmode.at': '',    // Production: nginx proxies /api to backend pod
        '91.99.193.87': '',            // Manualmode server: IP fallback
        
        // Local development - connect to local backend
        'localhost:5173': 'http://localhost:3001',  // Vite dev server
        'localhost:3000': 'http://localhost:3001',  // Alternative dev port
        '127.0.0.1:5173': 'http://localhost:3001',
        '127.0.0.1:3000': 'http://localhost:3001',
    };
    
    if (backendMap[hostnameWithPort]) {
        return backendMap[hostnameWithPort];
    }

    // 3. Fallback for localhost and any other unknown domains (e.g., custom deployments).
    // For localhost without port or other unknown domains, use local backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001';
    }
    // For deployed environments, assume a reverse proxy is in place
    return '';
};


const SESSION_KEY = 'user_session';

interface Session {
    token: string;
    user: User;
}

// --- Session Management ---

export const setSession = (session: Session): void => {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
        console.error("Could not save session:", error);
    }
};

export const getSession = (): Session | null => {
    try {
        const sessionStr = localStorage.getItem(SESSION_KEY);
        if (!sessionStr) {
            return null;
        }
        return JSON.parse(sessionStr);
    } catch (error) {
        console.error("Could not retrieve or parse session:", error);
        clearSession();
        return null;
    }
};

export const clearSession = (): void => {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (error) {
        console.error("Could not clear session:", error);
    }
};


// --- API Fetch Wrapper ---

export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const session = getSession();
    const headers = new Headers(options.headers || {});

    if (session && session.token) {
        headers.set('Authorization', `Bearer ${session.token}`);
    }

    if (options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    
    const config: RequestInit = {
        ...options,
        headers,
    };

    // Get API base URL dynamically for each request (to support ?backend=staging query param)
    const apiBaseUrl = getApiBaseUrl();
    const finalUrl = `${apiBaseUrl}/api${endpoint}`;

    let response;
    try {
        response = await fetch(finalUrl, config);
    } catch (error: any) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             throw new ApiError(
                `Could not connect to the server at ${apiBaseUrl}.`, 
                0, { error: 'Network Error' }, true, apiBaseUrl
            );
        }
        throw error;
    }

    if (response.ok) {
        if (response.status === 204) return null; // Handle No Content
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        return { success: true };
    }

    // --- Error Handling ---
    let errorData;
    try {
        errorData = await response.json();
    } catch (e) {
        errorData = { error: `HTTP Error ${response.status}: ${response.statusText}` };
    }

    const isAuthEndpoint = endpoint.startsWith('/auth/');
    if (response.status === 401 && session?.token && !isAuthEndpoint) {
        clearSession();
        window.location.reload();
        return new Promise(() => {}); // Prevent further processing
    }
    
    throw new ApiError(errorData.error || errorData.message || 'An unknown API error occurred.', response.status, errorData, false, apiBaseUrl);
};

// Helper function to get auth headers
export const getAuthHeaders = (): HeadersInit => {
    const session = getSession();
    const headers: HeadersInit = {
        'Content-Type': 'application/json'
    };
    if (session?.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
    }
    return headers;
};

// ============================================================================
// Personality Profile API
// ============================================================================

const API_BASE_URL = getApiBaseUrl();

export const savePersonalityProfile = async (data: {
  testType?: string; // Legacy - optional
  completedLenses?: string[];
  filterWorry?: number;
  filterControl?: number;
  encryptedData: string;
  adaptationMode?: 'adaptive' | 'stable';
}) => {
  const response = await fetch(`${API_BASE_URL}/api/personality/save`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error('Failed to save personality profile');
  }
  return response.json();
};

export const loadPersonalityProfile = async () => {
  const response = await fetch(`${API_BASE_URL}/api/personality/profile`, {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to load personality profile');
  }
  
  return response.json();
};

export const deletePersonalityProfile = async (): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/personality/profile`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete personality profile');
  }
  
  return response.json();
};

export const submitSessionLog = async (data: {
  chatHistory: any[];
  sessionId: string;
  comfortScore: number | null;
  optedOut: boolean;
  encryptionKey: CryptoKey;
  language?: 'de' | 'en';
}) => {
  const { analyzeSession } = await import('../utils/sessionBehaviorAnalyzer');
  
  // Analyze chat history for all three profile types (Riemann, Big5, SD)
  // This extracts delta values (high - low keyword counts) for DPFL refinement
  const lang = data.language || 'en';
  const frequencies = analyzeSession(data.chatHistory, lang);
  
  // Note: Transcript is NOT stored (GDPR compliance)
  // User can download transcript immediately after session
  
  const response = await fetch(`${API_BASE_URL}/api/personality/session-log`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      sessionId: data.sessionId,
      frequencies
      // encryptedTranscript removed - not stored anymore
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to submit session log');
  }
  
  // Submit comfort check
  if (!data.optedOut) {
    const comfortResponse = await fetch(`${API_BASE_URL}/api/personality/comfort-check`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        sessionId: data.sessionId,
        comfortScore: data.comfortScore,
        optedOut: false
      })
    });
    
    if (!comfortResponse.ok) {
      throw new Error('Failed to submit comfort check');
    }
  }
  
  return { success: true };
};

export const getProfileRefinementSuggestions = async () => {
  const response = await fetch(`${API_BASE_URL}/api/personality/adaptation-suggestions`, {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error('Failed to load refinement suggestions');
  }
  
  return response.json();
};

export const checkPersonalityProfile = async (): Promise<boolean> => {
  try {
    const profile = await loadPersonalityProfile();
    return profile !== null;
  } catch (error) {
    return false;
  }
};

export const generateNarrativeProfile = async (data: {
  quantitativeData: {
    testType?: string; // Legacy - optional
    completedLenses?: string[];
    filter?: { worry: number; control: number };
    spiralDynamics?: any;
    riemann?: any;
    big5?: any;
  };
  narratives: { flowStory: string; frictionStory: string };
  language: string;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/personality/generate-narrative`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate narrative profile');
  }
  return response.json();
};

export const logSessionBehavior = async (data: {
  sessionId: string;
  encryptedTranscript: string;
  frequencies: Record<string, number>;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/personality/session-log`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error('Failed to log session behavior');
  }
  return response.json();
};

export const submitComfortCheck = async (sessionId: string, score: number, optOut?: boolean) => {
  const response = await fetch(`${API_BASE_URL}/api/personality/comfort-check`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId, score, optOut })
  });
  if (!response.ok) {
    throw new Error('Failed to submit comfort check');
  }
  return response.json();
};

export const getAdaptationSuggestions = async () => {
  const response = await fetch(`${API_BASE_URL}/api/personality/adaptation-suggestions`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    throw new Error('Failed to get adaptation suggestions');
  }
  return response.json();
};

/**
 * Preview profile refinement based on chat history (dry-run, no save)
 * Used for admin tests to see how a session would affect the profile
 */

// Bidirectional keyword analysis result for a single dimension
interface BidirectionalDimensionAnalysis {
  high: number;
  low: number;
  delta: number;
  foundKeywords: {
    high: string[];
    low: string[];
  };
}

export interface RefinementPreviewResult {
  success: boolean;
  isPreviewOnly: boolean;
  // New bidirectional analysis format
  bidirectionalAnalysis: {
    // Riemann dimensions
    naehe?: BidirectionalDimensionAnalysis;
    distanz?: BidirectionalDimensionAnalysis;
    dauer?: BidirectionalDimensionAnalysis;
    wechsel?: BidirectionalDimensionAnalysis;
    // Big5 dimensions
    openness?: BidirectionalDimensionAnalysis;
    conscientiousness?: BidirectionalDimensionAnalysis;
    extraversion?: BidirectionalDimensionAnalysis;
    agreeableness?: BidirectionalDimensionAnalysis;
    neuroticism?: BidirectionalDimensionAnalysis;
    // Metadata
    messageCount: number;
  };
  refinementResult: {
    hasSuggestions: boolean;
    // Riemann: nested structure with contexts (beruf, privat, selbst)
    suggestions?: Record<string, {
      current: Record<string, number>;
      suggested: Record<string, number>;
      deltas: Record<string, number>;
    }>;
    // Big5: flat structure at top level
    current?: Record<string, number>;
    suggested?: Record<string, number>;
    deltas?: Record<string, number>;
    // Found keywords (from refinement service)
    foundKeywords?: Record<string, { high: string[]; low: string[] }>;
    // Common fields
    sessionCount?: number;
    weight?: number;
    reason?: string;
  };
  profileType: string;
  message: string;
}

export const previewProfileRefinement = async (data: {
  chatHistory: Array<{ role: string; text: string }>;
  decryptedProfile: Record<string, unknown>;
  profileType: 'RIEMANN' | 'BIG5';
  lang: string;
}): Promise<RefinementPreviewResult> => {
  const response = await fetch(`${API_BASE_URL}/api/personality/preview-refinement`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to preview refinement');
  }
  return response.json();
};

export const testRefinementWithMockSessions = async (data: {
  profileType: 'RIEMANN' | 'BIG5' | 'SD';
  decryptedProfile: Record<string, unknown>;
  mockSessions: Array<{
    // Riemann frequencies (for RIEMANN profile)
    riemann?: {
      dauer?: number;
      wechsel?: number;
      naehe?: number;
      distanz?: number;
    };
    // Big5 frequencies (for BIG5 profile)
    big5?: {
      openness?: number;
      conscientiousness?: number;
      extraversion?: number;
      agreeableness?: number;
      neuroticism?: number;
    };
    comfortScore: number;
  }>;
}): Promise<RefinementPreviewResult> => {
  const response = await fetch(`${API_BASE_URL}/api/personality/test-refinement-mock`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to test mock refinement');
  }
  return response.json();
};