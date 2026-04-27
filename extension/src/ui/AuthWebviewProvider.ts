// src/ui/AuthWebviewProvider.ts

import * as vscode from 'vscode';
import { AuthService } from '../services/AuthService';
import { Logger } from '../utils/logger';

/**
 * Provides authentication webview UI
 */
export class AuthWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private authService: AuthService
  ) {}

  /**
   * Show authentication webview
   */
  public show(): void {
    // If panel already exists, reveal it
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Create new webview panel
    this.panel = vscode.window.createWebviewPanel(
      'devskillAuth',
      'DevSkill Tracker - Sign In',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    // Set HTML content
    this.panel.webview.html = this.getWebviewContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      undefined,
      this.context.subscriptions
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Close the webview
   */
  public close(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'signIn':
        await this.handleSignIn(message.email, message.password);
        break;

      case 'signInWithGoogle':
        await this.handleGoogleSignIn();
        break;

      case 'cancel':
        this.close();
        break;
    }
  }

  /**
   * Handle Google sign in
   */
  private async handleGoogleSignIn(): Promise<void> {
    try {
      this.panel?.webview.postMessage({ command: 'loading', message: 'Opening Google sign-in in your browser...' });
      await this.authService.signInWithGoogle();
      this.panel?.webview.postMessage({ command: 'success', message: 'Signed in with Google!' });
      setTimeout(() => this.close(), 1500);
    } catch (error: any) {
      Logger.error('Google sign in failed in webview', error);
      this.panel?.webview.postMessage({
        command: 'error',
        message: error.message || 'Google sign-in failed. Please try again.'
      });
    }
  }

  /**
   * Handle sign in
   */
  private async handleSignIn(email: string, password: string): Promise<void> {
    try {
      // Send loading state
      this.panel?.webview.postMessage({
        command: 'loading',
        message: 'Signing in...'
      });

      await this.authService.signInWithEmail(email, password);

      // Send success
      this.panel?.webview.postMessage({
        command: 'success',
        message: `Welcome back, ${email}!`
      });

      // Close panel after short delay
      setTimeout(() => {
        this.close();
        vscode.window.showInformationMessage(`Signed in as ${email}`);
      }, 1500);

    } catch (error: any) {
      Logger.error('Sign in failed in webview', error);

      // Send error to webview
      this.panel?.webview.postMessage({
        command: 'error',
        message: this.formatErrorMessage(error.message)
      });
    }
  }

  /**
   * Format error message for display
   */
  private formatErrorMessage(message: string): string {
    // Firebase error messages mapping
    const errorMap: Record<string, string> = {
      'EMAIL_EXISTS': 'This email is already registered. Please sign in instead.',
      'INVALID_PASSWORD': 'Incorrect password. Please try again.',
      'EMAIL_NOT_FOUND': 'No account found with this email. Please sign up first.',
      'INVALID_EMAIL': 'Please enter a valid email address.',
      'WEAK_PASSWORD': 'Password should be at least 6 characters.',
      'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many failed attempts. Please try again later.',
      'USER_DISABLED': 'This account has been disabled.'
    };

    // Check if message contains any known error
    for (const [key, value] of Object.entries(errorMap)) {
      if (message.includes(key)) {
        return value;
      }
    }

    return message || 'Authentication failed. Please try again.';
  }

  /**
   * Get webview HTML content
   */
  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevSkill Tracker - Sign In</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 40px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }

    .container {
      max-width: 400px;
      width: 100%;
    }

    .logo {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo h1 {
      font-size: 28px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 8px;
    }

    .logo p {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }

    .card {
      background-color: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .tab {
      flex: 1;
      padding: 12px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .tab:hover {
      color: var(--vscode-textLink-foreground);
    }

    .tab.active {
      color: var(--vscode-textLink-foreground);
      border-bottom-color: var(--vscode-textLink-foreground);
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--vscode-input-foreground);
    }

    input {
      width: 100%;
      padding: 10px 12px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 13px;
      font-family: var(--vscode-font-family);
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus {
      border-color: var(--vscode-focusBorder);
    }

    input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .btn {
      width: 100%;
      padding: 12px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-top: 8px;
    }

    .btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      margin-top: 12px;
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .message {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 13px;
      display: none;
    }

    .message.show {
      display: block;
    }

    .message.error {
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-errorForeground);
    }

    .message.success {
      background-color: var(--vscode-terminal-ansiGreen);
      color: var(--vscode-editor-background);
    }

    .message.loading {
      background-color: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      color: var(--vscode-input-foreground);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid var(--vscode-input-foreground);
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .help-text {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
    }

    .password-wrapper {
      position: relative;
    }

    .password-wrapper input {
      padding-right: 40px;
    }

    .toggle-pw {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--vscode-descriptionForeground);
      padding: 0;
      width: auto;
      display: flex;
      align-items: center;
    }

    .toggle-pw:hover {
      color: var(--vscode-input-foreground);
    }

    .divider {
      display: flex;
      align-items: center;
      margin: 20px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .divider span {
      padding: 0 12px;
    }

    .btn-google {
      width: 100%;
      padding: 10px 12px;
      background-color: #ffffff;
      color: #3c4043;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: background-color 0.2s;
      margin-top: 4px;
    }

    .btn-google:hover {
      background-color: #f8f9fa;
    }

    .btn-google:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>DevSkill Tracker</h1>
      <p>Track your coding journey with AI-powered insights</p>
    </div>

    <div class="card">
      <div id="message" class="message"></div>

      <!-- Sign In Form -->
      <form id="signin-form" onsubmit="handleSignIn(event)">
        <div class="form-group">
          <label for="signin-email">Email Address</label>
          <input
            type="email"
            id="signin-email"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="signin-password">Password</label>
          <div class="password-wrapper">
            <input
              type="password"
              id="signin-password"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
            <button type="button" class="toggle-pw" onclick="togglePassword()" aria-label="Show/hide password">
              <svg id="eye-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>

        <button type="submit" class="btn" id="signin-btn">
          Sign In
        </button>

        <div class="divider"><span>or</span></div>

        <button type="button" class="btn-google" id="google-btn" onclick="signInWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Sign in with Google
        </button>

        <button type="button" class="btn btn-secondary" onclick="cancel()">
          Cancel
        </button>

        <p class="help-text" style="margin-top: 16px; text-align: center;">
          Don't have an account? Register at the DevSkill Dashboard first.
        </p>
      </form>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Handle sign in
    function handleSignIn(event) {
      event.preventDefault();

      const email = document.getElementById('signin-email').value;
      const password = document.getElementById('signin-password').value;

      // Disable form
      setFormDisabled(true);

      // Send message to extension
      vscode.postMessage({
        command: 'signIn',
        email,
        password
      });
    }

    // Toggle password visibility
    function togglePassword() {
      const input = document.getElementById('signin-password');
      const icon = document.getElementById('eye-icon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
      } else {
        input.type = 'password';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
      }
    }

    // Sign in with Google
    function signInWithGoogle() {
      setFormDisabled(true);
      vscode.postMessage({ command: 'signInWithGoogle' });
    }

    // Cancel
    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }

    // Show message
    function showMessage(type, text) {
      const messageEl = document.getElementById('message');
      messageEl.className = 'message show ' + type;

      if (type === 'loading') {
        messageEl.innerHTML = '<span class="spinner"></span>' + text;
      } else {
        messageEl.textContent = text;
      }
    }

    // Hide message
    function hideMessage() {
      const messageEl = document.getElementById('message');
      messageEl.className = 'message';
    }

    // Enable/disable form
    function setFormDisabled(disabled) {
      document.querySelectorAll('input, button').forEach(el => {
        el.disabled = disabled;
      });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.command) {
        case 'loading':
          showMessage('loading', message.message);
          break;

        case 'success':
          showMessage('success', message.message);
          break;

        case 'error':
          showMessage('error', message.message);
          setFormDisabled(false);
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
