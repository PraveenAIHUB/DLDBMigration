const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function checkServerStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL.replace('/api', '')}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export function showServerWarning() {
  const warning = document.createElement('div');
  warning.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #dc2626;
    color: white;
    padding: 16px;
    text-align: center;
    z-index: 9999;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  warning.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto;">
      <strong>⚠️ Backend Server Not Running</strong>
      <p style="margin: 8px 0 0 0; font-size: 14px;">
        This app requires a backend server. Please run: <code style="background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 4px;">npm run dev:all</code>
      </p>
    </div>
  `;
  document.body.prepend(warning);
}
