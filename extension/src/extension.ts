// src/extension.ts
import * as vscode from 'vscode';
import { ConfigService } from './services/ConfigService';
import { StorageService } from './services/StorageService';
import { TrackingService } from './services/TrackingService';
import { AuthService } from './services/AuthService';
import { APIService } from './services/APIService';
import { Logger, LogLevel } from './utils/logger';
import { LanguageDetector } from './utils/languageDetector';
import { registerAuthCommands } from './commands/authCommands';
import { CodeSessionRequest } from './types';

/**
 * Global services
 */
let configService: ConfigService;
let storageService: StorageService;
let trackingService: TrackingService;
let authService: AuthService;
let apiService: APIService;
let statusBar: vscode.StatusBarItem;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('DevSkill-Tracker: activating');

  // Initialize logger
  Logger.initialize('DevSkill Tracker', LogLevel.INFO);
  Logger.info('DevSkill-Tracker extension activating');

  try {
    // Initialize core services
    configService = new ConfigService(context);
    storageService = new StorageService(context);
    trackingService = new TrackingService(storageService, configService);
    authService = new AuthService(context, configService);
    apiService = new APIService(configService, authService);

    // Create status bar
    statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    statusBar.command = 'devskill-tracker.stopTracking';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Update status bar initially
    updateStatusBar();

    // Register commands
    registerCommands(context);
    registerAuthCommands(context, authService);

    // Listen to auth state changes to update status bar and verify user
    authService.onAuthStateChanged(async (state) => {
      updateStatusBar();

      // When user logs in, verify they exist in Firestore
      if (state.isAuthenticated && state.user?.email) {
        const verification = await apiService.verifyUser(state.user.email);

        if (!verification) {
          // User doesn't exist in Firestore - they need to register on web first
          Logger.warn('User not found in Firestore', { email: state.user.email });
          vscode.window.showErrorMessage(
            'Account not found. Please register at the DevSkill Dashboard first, then sign in here.'
          );
          await authService.signOut();
        } else {
          Logger.info('User verified in Firestore', {
            email: state.user.email,
            firestoreUserId: verification.userId
          });
        }
      }
    });

    // Set up status bar update timer
    const statusBarTimer = setInterval(() => updateStatusBar(), 1000);
    context.subscriptions.push({
      dispose: () => clearInterval(statusBarTimer)
    });

    // Register file save listener for automatic code analysis
    const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
      // Only analyze if tracking is running and user is authenticated
      if (!trackingService.isRunning() || !authService.isAuthenticated()) {
        return;
      }

      const user = authService.getCurrentUser();
      const session = trackingService.getSession();

      if (!user || !session) {
        return;
      }

      // Get the code and file info
      const code = document.getText();
      const fileName = document.fileName;
      const language = LanguageDetector.detectLanguage(fileName);

      // Skip non-code files
      if (!LanguageDetector.isCodeFile(fileName)) {
        Logger.debug(`Skipping non-code file: ${fileName}`);
        return;
      }

      // Skip very small files
      if (code.split('\n').length < 5) {
        Logger.debug(`Skipping small file: ${fileName}`);
        return;
      }

      // Calculate duration since session started
      const duration = (Date.now() - session.startTime) / 1000; // seconds
      const keystrokes = trackingService.getKeystrokeCount();

      // Build the request matching backend's CodeSession model
      const request: CodeSessionRequest = {
        userId: user.uid,
        email: user.email || '',
        code: code,
        language: language,
        fileName: fileName.split('/').pop() || fileName, // Just the filename, not full path
        duration: duration,
        keystrokes: keystrokes
      };

      Logger.info(`Submitting code for analysis: ${fileName}`, {
        language,
        codeLength: code.length,
        duration,
        keystrokes
      });

      // Send to backend for analysis
      const result = await apiService.analyzeCode(request);

      if (result) {
        Logger.info(`Analysis result for ${fileName}`, {
          skillLevel: result.stats.skillLevel,
          confidence: result.stats.confidence,
          aiProbability: result.stats.aiProbability
        });

        // Show notification if AI probability is high
        if (result.stats.aiProbability > 70) {
          vscode.window.showWarningMessage(
            `⚠️ High AI detection (${result.stats.aiProbability.toFixed(1)}%) for ${fileName.split('/').pop()}`
          );
        }
      }
    });
    context.subscriptions.push(saveListener);

    Logger.info('DevSkill-Tracker: commands registered');
    console.log('DevSkill-Tracker: activated successfully');
  } catch (error) {
    Logger.error('Failed to activate extension', error);
    vscode.window.showErrorMessage(`DevSkill Tracker failed to activate: ${error}`);
  }
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext) {
  // Start tracking command
  const startCmd = vscode.commands.registerCommand(
    'devskill-tracker.startTracking',
    () => {
      try {
        trackingService.start();
        updateStatusBar();
      } catch (error) {
        Logger.error('Failed to start tracking', error);
        vscode.window.showErrorMessage(`Failed to start tracking: ${error}`);
      }
    }
  );

  // Stop tracking command
  const stopCmd = vscode.commands.registerCommand(
    'devskill-tracker.stopTracking',
    () => {
      try {
        trackingService.stop();
        updateStatusBar();
      } catch (error) {
        Logger.error('Failed to stop tracking', error);
        vscode.window.showErrorMessage(`Failed to stop tracking: ${error}`);
      }
    }
  );

  // Show data command
  const showCmd = vscode.commands.registerCommand(
    'devskill-tracker.showData',
    () => {
      try {
        showCollectedData();
      } catch (error) {
        Logger.error('Failed to show data', error);
        vscode.window.showErrorMessage(`Failed to show data: ${error}`);
      }
    }
  );

  // Clear data command
  const clearCmd = vscode.commands.registerCommand(
    'devskill-tracker.clearData',
    async () => {
      try {
        const confirmation = await vscode.window.showWarningMessage(
          'Clear all tracking data? This cannot be undone.',
          { modal: true },
          'Clear Data'
        );

        if (confirmation === 'Clear Data') {
          await storageService.clearAll();
          vscode.window.showInformationMessage('All tracking data cleared.');
          Logger.info('All tracking data cleared by user');
        }
      } catch (error) {
        Logger.error('Failed to clear data', error);
        vscode.window.showErrorMessage(`Failed to clear data: ${error}`);
      }
    }
  );

  // Analyze current file command
  const analyzeCmd = vscode.commands.registerCommand(
    'devskill-tracker.analyzeFile',
    async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No file is currently open.');
          return;
        }

        // Check if user is authenticated
        if (!authService.isAuthenticated()) {
          vscode.window.showWarningMessage('Please sign in to analyze files.');
          return;
        }

        const user = authService.getCurrentUser();
        const session = trackingService.getSession();

        if (!user) {
          vscode.window.showWarningMessage('User not found. Please sign in again.');
          return;
        }

        vscode.window.showInformationMessage('Analyzing current file...');

        const document = editor.document;
        const code = document.getText();
        const fileName = document.fileName;
        const language = LanguageDetector.detectLanguage(fileName);

        // Skip non-code files
        if (!LanguageDetector.isCodeFile(fileName)) {
          vscode.window.showWarningMessage('This file type is not supported for analysis.');
          return;
        }

        // Calculate duration since session started (or 0 if no session)
        const duration = session ? (Date.now() - session.startTime) / 1000 : 0;
        const keystrokes = trackingService.getKeystrokeCount();

        // Build the request
        const request: CodeSessionRequest = {
          userId: user.uid,
          email: user.email || '',
          code: code,
          language: language,
          fileName: fileName.split('/').pop() || fileName,
          duration: duration,
          keystrokes: keystrokes
        };

        // Send to backend for analysis
        const result = await apiService.analyzeCode(request);

        if (result) {
          const summary = [
            `Skill Level: ${result.stats.skillLevel}`,
            `Confidence: ${result.stats.confidence.toFixed(1)}%`,
            `AI Detection: ${result.stats.aiProbability.toFixed(1)}%`
          ].join(' | ');

          if (result.stats.aiProbability > 70) {
            vscode.window.showWarningMessage(`⚠️ High AI Detection! ${summary}`);
          } else {
            vscode.window.showInformationMessage(`Analysis: ${summary}`);
          }

          Logger.info('Manual analysis complete', result.stats);
        } else {
          vscode.window.showWarningMessage('Could not connect to backend. Make sure the server is running.');
        }
      } catch (error) {
        Logger.error('Failed to analyze file', error);
        vscode.window.showErrorMessage(`Failed to analyze file: ${error}`);
      }
    }
  );

  context.subscriptions.push(startCmd, stopCmd, showCmd, clearCmd, analyzeCmd);
  context.subscriptions.push(trackingService);
  context.subscriptions.push(authService);
}

/**
 * Update status bar display
 */
function updateStatusBar() {
  // Check authentication state first
  if (!authService.isAuthenticated()) {
    statusBar.text = `$(person) DevSkill: Sign In`;
    statusBar.tooltip = `DevSkill Tracker - Click to sign in`;
    statusBar.command = 'devskill-tracker.signIn';
    return;
  }

  const user = authService.getCurrentUser();
  const userDisplay = user?.displayName || user?.email || 'User';

  if (!trackingService.isRunning()) {
    statusBar.text = `$(circle-slash) DevSkill: Stopped`;
    statusBar.tooltip = `Signed in as ${userDisplay}\nClick to start tracking`;
    statusBar.command = 'devskill-tracker.startTracking';
    return;
  }

  const elapsedMs = trackingService.getElapsedTime();
  const sec = Math.floor(elapsedMs / 1000) % 60;
  const min = Math.floor(elapsedMs / 60000);

  const idleSuffix = trackingService.isIdle() ? ' (Idle)' : '';
  statusBar.text = `$(pulse) DevSkill: ${min}m ${sec}s${idleSuffix}`;

  const keystrokeCount = trackingService.getKeystrokeCount();
  statusBar.tooltip = `${userDisplay}\nRunning — Keystrokes: ${keystrokeCount}\nClick to stop tracking`;
  statusBar.command = 'devskill-tracker.stopTracking';
}

/**
 * Show collected data in output channel
 */
function showCollectedData() {
  const channel = vscode.window.createOutputChannel('DevSkill-Tracker Data');
  channel.clear();

  const session = trackingService.getSession();
  const events = trackingService.getEvents();
  const fileMetrics = trackingService.getFileMetrics();

  channel.appendLine('=== DevSkill-Tracker Collected Data ===');
  channel.appendLine('');

  // Session info
  channel.appendLine('=== Session Information ===');
  if (session) {
    channel.appendLine(JSON.stringify(session, null, 2));
  } else {
    channel.appendLine('No active session');
  }
  channel.appendLine('');

  // Events
  channel.appendLine(`=== Events (${events.length} total) ===`);
  channel.appendLine(JSON.stringify(events, null, 2));
  channel.appendLine('');

  // File metrics
  channel.appendLine(`=== Per File Stats (${Object.keys(fileMetrics).length} files) ===`);
  channel.appendLine(JSON.stringify(fileMetrics, null, 2));
  channel.appendLine('');

  // Storage stats
  const storageStats = storageService.getStorageStats();
  channel.appendLine('=== Storage Statistics ===');
  channel.appendLine(JSON.stringify(storageStats, null, 2));

  channel.show(true);
  Logger.info('Displayed collected data');
}

/**
 * Extension deactivation
 */
export function deactivate() {
  console.log('DevSkill-Tracker: deactivating');
  Logger.info('DevSkill-Tracker extension deactivating');

  if (trackingService) {
    trackingService.dispose();
  }

  if (authService) {
    authService.dispose();
  }

  Logger.dispose();
}
