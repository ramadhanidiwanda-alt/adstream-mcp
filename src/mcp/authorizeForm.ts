/**
 * HTML form template for the /authorize page.
 *
 * Security:
 * - All user-facing values are HTML-escaped
 * - Connection key is NEVER echoed back in the form
 * - Hidden fields carry OAuth params from the original request
 */

export interface AuthorizeFormParams {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
  error?: string;
  resource?: string;
  returnTo?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderAuthorizeForm(params: AuthorizeFormParams): string {
  const errorHtml = params.error
    ? `<div class="error">${escapeHtml(params.error)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Cuan Insight MCP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #333;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      padding: 40px;
      max-width: 440px;
      width: 100%;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    p {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    label {
      font-size: 14px;
      font-weight: 500;
      display: block;
      margin-bottom: 6px;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
    }
    button {
      width: 100%;
      padding: 12px;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 16px;
      transition: background 0.2s;
    }
    button:hover { background: #4338ca; }
    .error {
      background: #fef2f2;
      color: #dc2626;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      border: 1px solid #fecaca;
    }
    .scope-info {
      font-size: 12px;
      color: #888;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect Cuan Insight MCP</h1>
    <p>Masukkan Connection Key dari Cuan Insight untuk menghubungkan MCP ke AI client Anda.</p>
    ${errorHtml}
    <form method="post" action="/authorize">
      <label for="connection_key">Connection Key</label>
      <input
        type="password"
        id="connection_key"
        name="connection_key"
        placeholder="Masukkan Connection Key"
        required
        autocomplete="off"
      />
      <input type="hidden" name="response_type" value="${escapeHtml(params.responseType)}" />
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}" />
      <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
      <input type="hidden" name="scope" value="${escapeHtml(params.scope)}" />
      ${params.resource ? `<input type="hidden" name="resource" value="${escapeHtml(params.resource)}" />` : ''}
      ${params.returnTo ? `<input type="hidden" name="return_to" value="${escapeHtml(params.returnTo)}" />` : ''}
      <button type="submit">Authorize</button>
    </form>
    <div class="scope-info">Scopes yang diminta: ${escapeHtml(params.scope)}</div>
  </div>
</body>
</html>`;
}
