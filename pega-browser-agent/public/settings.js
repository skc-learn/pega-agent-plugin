/**
 * Advanced LLM Settings - Multi-Provider Configuration
 *
 * Supports multiple providers with priority-based fallback,
 * advanced options, and configuration management.
 */

// Provider configurations
const PROVIDER_CONFIGS = {
  anthropic: {
    name: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-4-20250514',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultMaxTokens: 2048,
    defaultTemperature: 0.1,
  },
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultMaxTokens: 2048,
    defaultTemperature: 0.1,
  },
  azure: {
    name: 'Azure OpenAI',
    defaultModel: '',
    defaultEndpoint: '',
    defaultMaxTokens: 2048,
    defaultTemperature: 0.1,
  },
  google: {
    name: 'Google AI',
    defaultModel: 'gemini-1.5-pro',
    defaultEndpoint: 'https://generativelanguage.googleapis.com',
    defaultMaxTokens: 2048,
    defaultTemperature: 0.1,
  },
  local: {
    name: 'Custom/Local',
    defaultModel: '',
    defaultEndpoint: 'http://localhost:11434/v1/chat/completions',
    defaultMaxTokens: 2048,
    defaultTemperature: 0.1,
  },
  mistral: {
    name: 'Mistral AI',
    defaultModel: 'mistral-large-latest',
    defaultEndpoint: 'https://api.mistral.ai/v1',
    defaultMaxTokens: 2048,
    defaultTemperature: 0.1,
  },
};

// Default settings structure
const DEFAULT_SETTINGS = {
  providers: [],
  fallbackEnabled: true,
  maxRetries: 2,
  timeoutMs: 10000,
  defaultMaxTokens: 2048,
  defaultTemperature: 0.1,
  streamingEnabled: false,
  cacheEnabled: true,
  cacheTtl: 600000,
  logLevel: 'warn',
  logRequests: false,
  mcpServers: [],
  mcpEnabled: true,
};

// Current settings state
let settings = { ...DEFAULT_SETTINGS };

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  updateFallbackList();
  updateTemperatureDisplays();
  renderMCPServerList();
});

/**
 * Load settings from chrome.storage
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('llmSettings');

    // Handle legacy single-provider format
    if (result.llmSettings?.apiKey) {
      settings.providers = [{
        provider: 'anthropic',
        enabled: true,
        apiKey: result.llmSettings.apiKey,
        model: result.llmSettings.model || PROVIDER_CONFIGS.anthropic.defaultModel,
        endpoint: result.llmSettings.endpoint || PROVIDER_CONFIGS.anthropic.defaultEndpoint,
        maxTokens: result.llmSettings.maxTokens || 2048,
        temperature: result.llmSettings.temperature ?? 0.1,
        priority: 1,
      }];
    } else if (result.llmSettings?.providers) {
      settings = { ...DEFAULT_SETTINGS, ...result.llmSettings };
    }

    renderSettings();
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings: ' + error.message, 'error');
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Temperature sliders
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const valueDisplay = e.target.parentElement.querySelector('.range-value');
      if (valueDisplay) {
        valueDisplay.textContent = e.target.value;
      }
    });
  });

  // Provider toggles - update priority badges
  Object.keys(PROVIDER_CONFIGS).forEach(provider => {
    const toggle = document.getElementById(`${provider}-enabled`);
    if (toggle) {
      toggle.addEventListener('change', () => updatePriorityBadges());
    }
  });

  // Action buttons
  document.getElementById('save-btn')?.addEventListener('click', saveSettings);
  document.getElementById('reset-btn')?.addEventListener('click', resetSettings);
  document.getElementById('export-btn')?.addEventListener('click', exportSettings);
  document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });
  document.getElementById('import-file')?.addEventListener('change', importSettings);

  // Test connection buttons (event delegation)
  document.querySelectorAll('.test-connection-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider;
      if (provider) testConnection(provider);
    });
  });

  // MCP Server buttons
  document.getElementById('add-mcp-btn')?.addEventListener('click', showAddMCPServerModal);
  document.getElementById('mcp-cancel-btn')?.addEventListener('click', closeMCPServerModal);
  document.getElementById('mcp-save-btn')?.addEventListener('click', saveMCPServer);
  document.getElementById('mcp-modal-close')?.addEventListener('click', closeMCPServerModal);

  // Advanced toggles
  document.querySelectorAll('.advanced-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('expanded');
    });
  });
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });

  // Update fallback list when switching to fallback tab
  if (tabId === 'fallback') {
    updateFallbackList();
  }
}

// ============================================================================
// CARD MANAGEMENT
// ============================================================================

function toggleCard(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('collapsed');
}

function toggleAdvanced(toggle) {
  const options = toggle.nextElementSibling;
  options.classList.toggle('visible');
  toggle.querySelector('span').textContent = options.classList.contains('visible') ? '▲' : '▼';
}

// Make functions available globally for onclick handlers
window.toggleCard = toggleCard;
window.toggleAdvanced = toggleAdvanced;

// ============================================================================
// SETTINGS RENDERING
// ============================================================================

function renderSettings() {
  // Render each provider
  Object.keys(PROVIDER_CONFIGS).forEach(providerId => {
    const providerSettings = settings.providers.find(p => p.provider === providerId) || {};
    const config = PROVIDER_CONFIGS[providerId];

    // Enable toggle
    const enabledEl = document.getElementById(`${providerId}-enabled`);
    if (enabledEl) {
      enabledEl.checked = providerSettings.enabled ?? false;
    }

    // API Key
    const keyEl = document.getElementById(`${providerId}-key`);
    if (keyEl) {
      keyEl.value = providerSettings.apiKey || '';
    }

    // Model
    const modelEl = document.getElementById(`${providerId}-model`);
    if (modelEl) {
      if (modelEl.tagName === 'SELECT') {
        modelEl.value = providerSettings.model || config.defaultModel;
      } else {
        modelEl.value = providerSettings.model || '';
      }
    }

    // Endpoint
    const endpointEl = document.getElementById(`${providerId}-endpoint`);
    if (endpointEl) {
      endpointEl.value = providerSettings.endpoint || config.defaultEndpoint;
    }

    // Priority
    const priorityEl = document.getElementById(`${providerId}-priority`);
    if (priorityEl) {
      priorityEl.value = providerSettings.priority || 1;
    }

    // Max Tokens
    const maxTokensEl = document.getElementById(`${providerId}-max-tokens`);
    if (maxTokensEl) {
      maxTokensEl.value = providerSettings.maxTokens || config.defaultMaxTokens;
    }

    // Temperature
    const tempEl = document.getElementById(`${providerId}-temperature`);
    if (tempEl) {
      tempEl.value = providerSettings.temperature ?? config.defaultTemperature;
    }

    // Azure-specific: deployment name
    if (providerId === 'azure') {
      const deploymentEl = document.getElementById('azure-deployment');
      if (deploymentEl) {
        deploymentEl.value = providerSettings.deployment || '';
      }
      const apiVersionEl = document.getElementById('azure-api-version');
      if (apiVersionEl) {
        apiVersionEl.value = providerSettings.apiVersion || '2024-02-15-preview';
      }
    }
  });

  // Global settings
  document.getElementById('fallback-enabled').checked = settings.fallbackEnabled ?? true;
  document.getElementById('max-retries').value = settings.maxRetries || 2;
  document.getElementById('timeout').value = settings.timeoutMs || 10000;
  document.getElementById('default-max-tokens').value = settings.defaultMaxTokens || 2048;
  document.getElementById('default-temperature').value = settings.defaultTemperature ?? 0.1;
  document.getElementById('streaming-enabled').checked = settings.streamingEnabled ?? false;
  document.getElementById('cache-enabled').checked = settings.cacheEnabled ?? true;
  document.getElementById('cache-ttl').value = settings.cacheTtl || 600000;
  document.getElementById('log-level').value = settings.logLevel || 'warn';
  document.getElementById('log-requests').checked = settings.logRequests ?? false;

  updatePriorityBadges();
}

function updateTemperatureDisplays() {
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    const valueDisplay = slider.parentElement.querySelector('.range-value');
    if (valueDisplay) {
      valueDisplay.textContent = slider.value;
    }
  });
}

function updatePriorityBadges() {
  const enabledProviders = [];

  Object.keys(PROVIDER_CONFIGS).forEach(providerId => {
    const toggle = document.getElementById(`${providerId}-enabled`);
    const card = document.querySelector(`[data-provider="${providerId}"]`);
    const badge = card?.querySelector('.priority-badge');

    if (toggle?.checked) {
      const priorityEl = document.getElementById(`${providerId}-priority`);
      const priority = parseInt(priorityEl?.value || '1', 10);
      enabledProviders.push({ providerId, priority, badge });
    } else if (badge) {
      badge.style.display = 'none';
    }
  });

  // Sort by priority and update badges
  enabledProviders.sort((a, b) => a.priority - b.priority);
  enabledProviders.forEach((item, index) => {
    if (item.badge) {
      item.badge.textContent = `Priority ${index + 1}`;
      item.badge.style.display = 'inline';
    }
  });
}

// ============================================================================
// FALLBACK LIST
// ============================================================================

function updateFallbackList() {
  const listEl = document.getElementById('fallback-list');
  if (!listEl) return;

  const enabledProviders = [];

  Object.keys(PROVIDER_CONFIGS).forEach(providerId => {
    const toggle = document.getElementById(`${providerId}-enabled`);
    if (toggle?.checked) {
      const priorityEl = document.getElementById(`${providerId}-priority`);
      const priority = parseInt(priorityEl?.value || '1', 10);
      enabledProviders.push({
        providerId,
        name: PROVIDER_CONFIGS[providerId].name,
        priority,
      });
    }
  });

  // Sort by priority
  enabledProviders.sort((a, b) => a.priority - b.priority);

  if (enabledProviders.length === 0) {
    listEl.innerHTML = `
      <div class="fallback-item" style="justify-content: center; color: var(--text-secondary);">
        No providers enabled. Enable at least one provider above.
      </div>
    `;
    return;
  }

  listEl.innerHTML = enabledProviders.map((p, index) => `
    <div class="fallback-item">
      <span class="drag-handle">☰</span>
      <span class="status-indicator active"></span>
      <span class="provider-name">${index + 1}. ${p.name}</span>
      <span class="priority-badge">Priority ${p.priority}</span>
    </div>
  `).join('');
}

// ============================================================================
// SAVE SETTINGS
// ============================================================================

async function saveSettings() {
  const providers = [];

  // Collect provider settings
  Object.keys(PROVIDER_CONFIGS).forEach(providerId => {
    const enabledEl = document.getElementById(`${providerId}-enabled`);

    if (enabledEl?.checked) {
      const providerSettings = {
        provider: providerId,
        enabled: true,
        apiKey: document.getElementById(`${providerId}-key`)?.value || '',
        model: document.getElementById(`${providerId}-model`)?.value || PROVIDER_CONFIGS[providerId].defaultModel,
        endpoint: document.getElementById(`${providerId}-endpoint`)?.value || PROVIDER_CONFIGS[providerId].defaultEndpoint,
        maxTokens: parseInt(document.getElementById(`${providerId}-max-tokens`)?.value || '2048', 10),
        temperature: parseFloat(document.getElementById(`${providerId}-temperature`)?.value || '0.1'),
        priority: parseInt(document.getElementById(`${providerId}-priority`)?.value || '1', 10),
      };

      // Azure-specific fields
      if (providerId === 'azure') {
        providerSettings.deployment = document.getElementById('azure-deployment')?.value || '';
        providerSettings.apiVersion = document.getElementById('azure-api-version')?.value || '2024-02-15-preview';
        providerSettings.model = providerSettings.deployment; // Azure uses deployment name as model
      }

      providers.push(providerSettings);
    }
  });

  // Validate at least one provider is configured
  if (providers.length === 0) {
    showStatus('Please enable and configure at least one provider.', 'error');
    return;
  }

  // Validate API keys for non-local providers
  for (const provider of providers) {
    if (provider.provider !== 'local' && !provider.apiKey) {
      showStatus(`Please enter an API key for ${PROVIDER_CONFIGS[provider.provider].name}.`, 'error');
      return;
    }
  }

  // Collect global settings
  settings = {
    providers,
    fallbackEnabled: document.getElementById('fallback-enabled').checked,
    maxRetries: parseInt(document.getElementById('max-retries').value, 10),
    timeoutMs: parseInt(document.getElementById('timeout').value, 10),
    defaultMaxTokens: parseInt(document.getElementById('default-max-tokens').value, 10),
    defaultTemperature: parseFloat(document.getElementById('default-temperature').value),
    streamingEnabled: document.getElementById('streaming-enabled').checked,
    cacheEnabled: document.getElementById('cache-enabled').checked,
    cacheTtl: parseInt(document.getElementById('cache-ttl').value, 10),
    logLevel: document.getElementById('log-level').value,
    logRequests: document.getElementById('log-requests').checked,
  };

  try {
    await chrome.storage.sync.set({ llmSettings: settings });
    showStatus('Configuration saved successfully!', 'success');
    updatePriorityBadges();
    updateFallbackList();
  } catch (error) {
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
}

window.saveSettings = saveSettings;

// ============================================================================
// RESET SETTINGS
// ============================================================================

async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings to defaults? This will clear all API keys.')) {
    return;
  }

  settings = { ...DEFAULT_SETTINGS };

  try {
    await chrome.storage.sync.set({ llmSettings: settings });
    renderSettings();
    showStatus('Settings reset to defaults.', 'success');
  } catch (error) {
    showStatus('Failed to reset settings: ' + error.message, 'error');
  }
}

window.resetSettings = resetSettings;

// ============================================================================
// EXPORT / IMPORT
// ============================================================================

function exportSettings() {
  // Create export without API keys
  const exportData = {
    ...settings,
    providers: settings.providers.map(p => ({
      ...p,
      apiKey: '***REDACTED***', // Don't export API keys
    })),
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `pega-agent-llm-config-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showStatus('Configuration exported (API keys redacted for security).', 'success');
}

window.exportSettings = exportSettings;

function importSettings(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);

      // Validate structure
      if (!imported.providers || !Array.isArray(imported.providers)) {
        throw new Error('Invalid configuration file format');
      }

      // Merge with current settings (preserving API keys)
      const mergedProviders = imported.providers.map(importedProvider => {
        const existing = settings.providers.find(p => p.provider === importedProvider.provider);
        return {
          ...importedProvider,
          // Keep existing API key if imported one is redacted
          apiKey: importedProvider.apiKey === '***REDACTED***' && existing
            ? existing.apiKey
            : importedProvider.apiKey,
        };
      });

      settings = {
        ...DEFAULT_SETTINGS,
        ...imported,
        providers: mergedProviders,
      };

      renderSettings();
      showStatus('Configuration imported successfully. Please verify API keys.', 'success');
    } catch (error) {
      showStatus('Failed to import configuration: ' + error.message, 'error');
    }
  };

  reader.readAsText(file);
  event.target.value = ''; // Reset file input
}

window.importSettings = importSettings;

// ============================================================================
// TEST CONNECTION
// ============================================================================

async function testConnection(providerId) {
  const resultEl = document.getElementById(`${providerId}-test-result`);
  if (!resultEl) return;

  resultEl.className = 'test-result';
  resultEl.textContent = 'Testing connection...';

  const config = PROVIDER_CONFIGS[providerId];
  const apiKey = document.getElementById(`${providerId}-key`)?.value;
  const endpoint = document.getElementById(`${providerId}-endpoint`)?.value || config.defaultEndpoint;
  const model = document.getElementById(`${providerId}-model`)?.value || config.defaultModel;

  if (!apiKey && providerId !== 'local') {
    resultEl.className = 'test-result error';
    resultEl.textContent = 'Please enter an API key first.';
    return;
  }

  try {
    let testResult;

    switch (providerId) {
      case 'anthropic':
        testResult = await testAnthropicConnection(apiKey, model, endpoint);
        break;
      case 'openai':
        testResult = await testOpenAIConnection(apiKey, model);
        break;
      case 'azure':
        const deployment = document.getElementById('azure-deployment')?.value;
        testResult = await testAzureConnection(apiKey, endpoint, deployment);
        break;
      case 'google':
        testResult = await testGoogleConnection(apiKey, model);
        break;
      case 'local':
        testResult = await testLocalConnection(endpoint, model);
        break;
      case 'mistral':
        testResult = await testMistralConnection(apiKey, model);
        break;
      default:
        throw new Error('Unknown provider');
    }

    if (testResult.success) {
      resultEl.className = 'test-result success';
      resultEl.textContent = `✓ Connection successful! Model: ${testResult.model || model}`;
    } else {
      throw new Error(testResult.error || 'Connection failed');
    }
  } catch (error) {
    resultEl.className = 'test-result error';
    resultEl.textContent = `✗ ${error.message}`;
  }
}

window.testConnection = testConnection;

async function testAnthropicConnection(apiKey, model, endpoint) {
  const response = await fetch(`${endpoint}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return { success: true, model };
}

async function testOpenAIConnection(apiKey, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return { success: true, model };
}

async function testAzureConnection(apiKey, endpoint, deployment) {
  if (!deployment) {
    throw new Error('Deployment name is required');
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return { success: true, model: deployment };
}

async function testGoogleConnection(apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-pro'}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Say "ok"' }] }],
      generationConfig: { maxOutputTokens: 10 },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return { success: true, model };
}

async function testLocalConnection(endpoint, model) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'llama3.2',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return { success: true, model };
}

async function testMistralConnection(apiKey, model) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'mistral-large-latest',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return { success: true, model };
}

// ============================================================================
// STATUS DISPLAY
// ============================================================================

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      statusEl.className = 'status';
    }, 3000);
  }
}

// ============================================================================
// MCP SERVER MANAGEMENT
// ============================================================================

let editingMcpServerIndex = -1;

/**
 * Render the MCP server list
 */
function renderMCPServerList() {
  const listEl = document.getElementById('mcp-server-list');
  if (!listEl) return;

  if (!settings.mcpServers || settings.mcpServers.length === 0) {
    listEl.innerHTML = `
      <div class="mcp-server-item" style="justify-content: center; color: var(--text-secondary);">
        No MCP servers configured. Click "Add MCP Server" to add one.
      </div>
    `;
    return;
  }

  listEl.innerHTML = settings.mcpServers.map((server, index) => `
    <div class="mcp-server-item" data-index="${index}">
      <div class="mcp-server-info">
        <h4>
          ${server.name}
          <span class="mcp-badge ${server.enabled ? 'connected' : 'disconnected'}">
            ${server.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </h4>
        <p>${server.transport.toUpperCase()}: ${server.url || 'N/A'}</p>
      </div>
      <div class="mcp-server-actions">
        <button class="btn btn-secondary" onclick="testMCPServerConnection(${index})">Test</button>
        <button class="btn btn-secondary" onclick="editMCPServer(${index})">Edit</button>
        <button class="btn btn-secondary" onclick="deleteMCPServer(${index})">Delete</button>
      </div>
    </div>
  `).join('');
}

/**
 * Show the add MCP server modal
 */
function showAddMCPServerModal() {
  editingMcpServerIndex = -1;
  document.getElementById('mcp-modal-title').textContent = 'Add MCP Server';
  document.getElementById('mcp-server-name').value = '';
  document.getElementById('mcp-transport').value = 'websocket';
  document.getElementById('mcp-url').value = '';
  document.getElementById('mcp-headers').value = '';
  document.getElementById('mcp-enabled').checked = true;
  document.getElementById('mcp-modal').classList.add('visible');
}

/**
 * Edit an existing MCP server
 */
function editMCPServer(index) {
  editingMcpServerIndex = index;
  const server = settings.mcpServers[index];

  document.getElementById('mcp-modal-title').textContent = 'Edit MCP Server';
  document.getElementById('mcp-server-name').value = server.name || '';
  document.getElementById('mcp-transport').value = server.transport || 'websocket';
  document.getElementById('mcp-url').value = server.url || '';
  document.getElementById('mcp-headers').value = server.headers ? JSON.stringify(server.headers, null, 2) : '';
  document.getElementById('mcp-enabled').checked = server.enabled !== false;
  document.getElementById('mcp-modal').classList.add('visible');
}

/**
 * Close the MCP server modal
 */
function closeMCPServerModal() {
  document.getElementById('mcp-modal').classList.remove('visible');
  editingMcpServerIndex = -1;
}

/**
 * Save MCP server configuration
 */
async function saveMCPServer() {
  const name = document.getElementById('mcp-server-name').value.trim();
  const transport = document.getElementById('mcp-transport').value;
  const url = document.getElementById('mcp-url').value.trim();
  const headersText = document.getElementById('mcp-headers').value.trim();
  const enabled = document.getElementById('mcp-enabled').checked;

  // Validate
  if (!name) {
    showStatus('Server name is required', 'error');
    return;
  }
  if (!url) {
    showStatus('Server URL is required', 'error');
    return;
  }

  // Parse headers
  let headers = {};
  if (headersText) {
    try {
      headers = JSON.parse(headersText);
    } catch (e) {
      showStatus('Invalid JSON in custom headers', 'error');
      return;
    }
  }

  const serverConfig = {
    name,
    transport,
    url,
    headers,
    enabled,
  };

  // Initialize mcpServers if not exists
  if (!settings.mcpServers) {
    settings.mcpServers = [];
  }

  if (editingMcpServerIndex >= 0) {
    // Update existing
    settings.mcpServers[editingMcpServerIndex] = serverConfig;
  } else {
    // Check for duplicate name
    if (settings.mcpServers.some(s => s.name === name)) {
      showStatus('A server with this name already exists', 'error');
      return;
    }
    // Add new
    settings.mcpServers.push(serverConfig);
  }

  // Save to storage
  try {
    await chrome.storage.sync.set({ llmSettings: settings });
    renderMCPServerList();
    closeMCPServerModal();
    showStatus('MCP server saved successfully', 'success');
  } catch (error) {
    showStatus('Failed to save MCP server: ' + error.message, 'error');
  }
}

/**
 * Delete an MCP server
 */
async function deleteMCPServer(index) {
  if (!confirm('Are you sure you want to delete this MCP server?')) {
    return;
  }

  settings.mcpServers.splice(index, 1);

  try {
    await chrome.storage.sync.set({ llmSettings: settings });
    renderMCPServerList();
    showStatus('MCP server deleted', 'success');
  } catch (error) {
    showStatus('Failed to delete MCP server: ' + error.message, 'error');
  }
}

/**
 * Test MCP server connection
 */
async function testMCPServerConnection(index) {
  const server = settings.mcpServers[index];
  const listEl = document.getElementById('mcp-server-list');
  const itemEl = listEl.querySelector(`[data-index="${index}"]`);
  const badge = itemEl?.querySelector('.mcp-badge');

  if (badge) {
    badge.textContent = 'Testing...';
    badge.className = 'mcp-badge';
  }

  try {
    // Send message to service worker to test connection
    const response = await chrome.runtime.sendMessage({
      type: 'MCP_TEST_CONNECTION',
      serverConfig: server,
    });

    if (response.success) {
      if (badge) {
        badge.textContent = 'Connected';
        badge.className = 'mcp-badge connected';
      }
      showStatus(`Successfully connected to ${server.name}`, 'success');
    } else {
      throw new Error(response.error || 'Connection failed');
    }
  } catch (error) {
    if (badge) {
      badge.textContent = 'Error';
      badge.className = 'mcp-badge error';
    }
    showStatus(`Failed to connect to ${server.name}: ${error.message}`, 'error');
  }
}

// Make MCP functions globally available
window.showAddMCPServerModal = showAddMCPServerModal;
window.editMCPServer = editMCPServer;
window.closeMCPServerModal = closeMCPServerModal;
window.saveMCPServer = saveMCPServer;
window.deleteMCPServer = deleteMCPServer;
window.testMCPServerConnection = testMCPServerConnection;
