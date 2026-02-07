// src/services/APIService.ts

import { ConfigService } from './ConfigService';
import { AuthService } from './AuthService';
import { Logger } from '../utils/logger';
import {
  APIResponse,
  AIDetectionRequest,
  AIDetectionResponse,
  CodeSessionRequest,
  AnalyzeResponse,
  UserVerifyResponse,
  SessionStartRequest,
  SessionStartResponse,
  SessionUpdateRequest,
  SessionEndRequest
} from '../types';
import { CodeFeatures } from '../types/tracking.types';

/**
 * APIService handles all communication with the DevSkill backend
 */
export class APIService {
  private baseUrl: string;
  private timeout: number;

  constructor(
    private config: ConfigService,
    private auth: AuthService
  ) {
    const apiConfig = config.getAPI();
    this.baseUrl = apiConfig.baseUrl;
    this.timeout = apiConfig.timeout;
  }

  /**
   * Verify that a user exists in the backend/Firestore
   * Called during login to ensure user has registered on the web first
   *
   * @param email - User's email address
   * @returns User verification response with userId or null if not found
   */
  async verifyUser(email: string): Promise<UserVerifyResponse | null> {
    try {
      Logger.info('Verifying user exists in backend', { email });

      const response = await this.get<UserVerifyResponse>(`/get-user-id/${encodeURIComponent(email)}`);

      if (response) {
        Logger.info('User verified successfully', { userId: response.userId });
      }

      return response;
    } catch (error) {
      Logger.error('User verification failed', error);
      return null;
    }
  }

  /**
   * Submit code for analysis to the backend
   * This is the main endpoint that stores sessions in Firestore
   *
   * @param request - Code session data matching backend's CodeSession model
   * @returns Analysis response with skill level, confidence, and AI probability
   */
  async analyzeCode(request: CodeSessionRequest): Promise<AnalyzeResponse | null> {
    try {
      Logger.info('Submitting code for analysis', {
        fileName: request.fileName,
        language: request.language,
        duration: request.duration,
        keystrokes: request.keystrokes
      });

      const response = await this.post<AnalyzeResponse>('/analyze', request);

      if (response) {
        Logger.info('Code analysis complete', {
          skillLevel: response.stats.skillLevel,
          confidence: response.stats.confidence,
          aiProbability: response.stats.aiProbability
        });
      }

      return response;

    } catch (error) {
      Logger.error('Code analysis request failed', error);
      return null;
    }
  }

  /**
   * Start a persistent session in the backend.
   * Creates ONE Firestore session document that persists until stopped.
   */
  async startSession(request: SessionStartRequest): Promise<SessionStartResponse | null> {
    try {
      Logger.info('Starting persistent session in backend', { userId: request.userId });
      const response = await this.post<SessionStartResponse>('/session/start', request);
      if (response) {
        Logger.info('Persistent session started', { sessionId: response.sessionId });
      }
      return response;
    } catch (error) {
      Logger.error('Failed to start persistent session', error);
      return null;
    }
  }

  /**
   * Update a persistent session with latest metrics.
   * Called periodically (every 30s) to sync data to Firestore.
   */
  async updateSession(sessionId: string, data: SessionUpdateRequest): Promise<boolean> {
    try {
      const response = await this.put<{ status: string }>(`/session/${sessionId}/update`, data);
      return response !== null;
    } catch (error) {
      Logger.error('Failed to update persistent session', error);
      return false;
    }
  }

  /**
   * End a persistent session.
   * Called when user stops tracking or exits VS Code.
   */
  async endSession(sessionId: string, data: SessionEndRequest): Promise<boolean> {
    try {
      Logger.info('Ending persistent session', { sessionId });
      const response = await this.post<{ status: string }>(`/session/${sessionId}/end`, data);
      if (response) {
        Logger.info('Persistent session ended', { sessionId });
      }
      return response !== null;
    } catch (error) {
      Logger.error('Failed to end persistent session', error);
      return false;
    }
  }

  /**
   * Send code features to backend for AI detection analysis
   * Legacy method - use analyzeCode for new implementations
   *
   * @param userId - Firebase user ID
   * @param sessionId - Current tracking session ID
   * @param filePath - Path to the analyzed file
   * @param features - Extracted code features (privacy-safe, no raw code)
   * @returns AI detection response with likelihood score
   */
  async detectAI(
    userId: string,
    sessionId: string,
    filePath: string,
    features: CodeFeatures
  ): Promise<AIDetectionResponse | null> {
    try {
      const request: AIDetectionRequest = {
        userId,
        sessionId,
        file: filePath,
        features,
        consentGiven: true
      };

      Logger.info('Sending features to backend for AI detection', {
        file: filePath,
        codeLines: features.codeLines
      });

      const response = await this.post<AIDetectionResponse>('/detect-ai', request);

      if (response) {
        Logger.info('AI detection complete', {
          aiLikelihood: response.aiLikelihoodScore,
          confidence: response.confidence
        });
      }

      return response;

    } catch (error) {
      Logger.error('AI detection request failed', error);
      return null;
    }
  }

  /**
   * Make a POST request to the backend
   */
  private async post<T>(endpoint: string, data: any): Promise<T | null> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth token if available
          ...(this.auth.isAuthenticated() && {
            'Authorization': `Bearer ${await this.auth.getToken()}`
          })
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(`API error: ${response.status}`, errorText);
        return null;
      }

      return await response.json() as T;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        Logger.error('Request timed out', { url, timeout: this.timeout });
      } else {
        Logger.error('Network error', { url, error: error.message });
      }
      return null;
    }
  }

  /**
   * Make a PUT request to the backend
   */
  private async put<T>(endpoint: string, data: any): Promise<T | null> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(this.auth.isAuthenticated() && {
            'Authorization': `Bearer ${await this.auth.getToken()}`
          })
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(`API error: ${response.status}`, errorText);
        return null;
      }

      return await response.json() as T;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        Logger.error('Request timed out', { url, timeout: this.timeout });
      } else {
        Logger.error('Network error', { url, error: error.message });
      }
      return null;
    }
  }

  /**
   * Make a GET request to the backend
   */
  private async get<T>(endpoint: string): Promise<T | null> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.auth.isAuthenticated() && {
            'Authorization': `Bearer ${await this.auth.getToken()}`
          })
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        Logger.error(`API error: ${response.status}`);
        return null;
      }

      return await response.json() as T;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        Logger.error('Request timed out', { url });
      } else {
        Logger.error('Network error', { url, error: error.message });
      }
      return null;
    }
  }

  /**
   * Check if the backend is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'HEAD'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Update the base URL (e.g., for local development)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    Logger.info(`API base URL updated to: ${url}`);
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
