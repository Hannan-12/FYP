// src/types/api.types.ts

import { TrackingSession, TrackingEvent, FileMetrics } from './tracking.types';
import { AnalysisRequest } from './analysis.types';

/**
 * API configuration
 */
export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
  batchSize: number;                   // Events per upload batch
  uploadIntervalMs: number;            // Auto-upload interval
}

/**
 * Upload queue item
 */
export interface UploadQueueItem {
  id: string;
  type: 'session' | 'events' | 'analysis';
  data: TrackingSession | TrackingEvent[] | AnalysisRequest;
  timestamp: number;
  attempts: number;
  lastAttempt?: number;
  status: 'pending' | 'uploading' | 'failed' | 'success';
  error?: string;
}

/**
 * Generic API response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

/**
 * Session upload request payload
 */
export interface SessionUploadRequest {
  session: TrackingSession;
  events: TrackingEvent[];
  fileMetrics: FileMetrics[];
}

/**
 * Session upload response
 */
export interface SessionUploadResponse {
  sessionId: string;
  eventsProcessed: number;
  timestamp: number;
}

/**
 * AI Detection request (sent to backend)
 * Matches backend's CodeSession model
 */
export interface AIDetectionRequest {
  userId: string;
  sessionId: string;
  file: string;
  features: import('./tracking.types').CodeFeatures;
  consentGiven: boolean;
}

/**
 * Code Session request for /analyze endpoint
 * This matches the backend's expected format exactly
 */
export interface CodeSessionRequest {
  userId: string;
  email: string;
  code: string;
  language: string;
  fileName: string;
  duration: number;     // seconds
  keystrokes: number;
}

/**
 * Analysis response from backend /analyze endpoint
 */
export interface AnalyzeResponse {
  status: string;
  stats: {
    skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
    confidence: number;       // 0-100
    aiProbability: number;    // 0-100
  };
}

/**
 * User verification response from backend
 */
export interface UserVerifyResponse {
  status: string;
  userId: string;
  email: string;
}

/**
 * Persistent session start request
 */
export interface SessionStartRequest {
  userId: string;
  email: string;
  language?: string;
}

/**
 * Persistent session start response
 */
export interface SessionStartResponse {
  status: string;
  sessionId: string;
}

/**
 * Persistent session update request
 */
export interface SessionUpdateRequest {
  totalKeystrokes: number;
  totalPastes: number;
  totalEdits: number;
  activeDuration: number;
  idleDuration: number;
  filesEdited: string[];
  languagesUsed: string[];
}

/**
 * Persistent session end request
 */
export interface SessionEndRequest {
  totalKeystrokes: number;
  totalPastes: number;
  totalEdits: number;
  totalDuration: number;
  activeDuration: number;
  idleDuration: number;
  filesEdited: string[];
  languagesUsed: string[];
}

/**
 * AI Detection response (from backend)
 */
export interface AIDetectionResponse {
  status: string;
  aiLikelihoodScore: number;  // 0-100 percentage
  confidence: number;          // 0-100 percentage
  signals: Record<string, { value?: number; score: number; [key: string]: any }>;
  recommendation: string;
}
