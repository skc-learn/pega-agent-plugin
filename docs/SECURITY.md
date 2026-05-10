# Security Documentation

## Overview

This document provides a comprehensive security analysis of the Pega Case Management Browser Agent, covering threat models, data protection mechanisms, compliance considerations, and security best practices.

**Version:** 1.0.0  
**Last Updated:** 2025-05-10  
**Security Classification:** Confidential

---

## 1. Security Architecture

### 1.1 Threat Model

#### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Content Scripts       │  Service Worker    │  Side Panel   │
│  (Isolated Context)    │  (Trusted Boundary)│  (UI Layer)   │
│                       │                    │               │
│  • PII Masking        │  • Session Store   │  • Display    │
│  • DOM Observation    │  • Audit Logging   │  • User Input │
│  • Token Resolution   │  • LLM Calls       │  • Confirmation│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  LLM API     │
                    │  (External)  │
                    └──────────────┘
```

#### Threat Categories

1. **Data Exfiltration**: Unauthorized transmission of sensitive PII
2. **Credential Theft**: Access to Pega authentication tokens
3. **Prompt Injection**: Malicious input compromising LLM behavior
4. **Session Hijacking**: Unauthorized access to user sessions
5. **Audit Tampering**: Modification or deletion of audit trails
6. **Authorization Bypass**: Executing actions beyond user permissions

#### Security Objectives

- **Confidentiality**: Protect PII through tokenization and masking
- **Integrity**: Ensure audit trail immutability and action validation
- **Availability**: Maintain service continuity without exposing data
- **Accountability**: Track all actions with comprehensive audit logging
- **Privacy**: Never transmit raw PII or authentication credentials externally

---

## 2. PII Protection

### 2.1 PII Categories

The agent classifies and protects 8 categories of Personally Identifiable Information:

| Category | Description | Example Patterns |
|----------|-------------|------------------|
| **NAME** | Full names, first/last names | `first_name`, `customer_name`, `insured_name` |
| **SSN** | Social Security Numbers, Tax IDs | `ssn`, `tax_id`, `ein`, `national_id` |
| **DOB** | Dates of Birth | `date_of_birth`, `dob`, `birth_date` |
| **EMAIL** | Email addresses | `email`, `email_address` |
| **PHONE** | Phone numbers, fax | `phone`, `mobile`, `cell`, `contact_number` |
| **ACCOUNT** | Account numbers, credit cards | `account_num`, `credit_card`, `policy_num` |
| **ADDRESS** | Street addresses, locations | `address`, `street`, `city`, `state`, `zip` |
| **INCOME** | Financial information | `income`, `salary`, `annual_income` |

### 2.2 Classification Algorithm

**Location:** `src/content-scripts/pii-masker.ts`

```typescript
classify(label: string | null, testId: string | null): PiiCategory {
  const combined = `${label ?? ''} ${testId ?? ''}`.toLowerCase();
  
  for (const [category, patterns] of Object.entries(PII_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(combined)) {
        return category as PiiCategory;
      }
    }
  }
  return null;
}
```

**Classification Strategy:**
1. Pattern matching on field labels and test IDs
2. Case-insensitive regex matching
3. Combined label + testId analysis
4. Returns null for non-PII fields

### 2.3 Tokenization Implementation

#### Token Format

```
{CATEGORY_COUNTER}
```

**Examples:**
- `{NAME_1}` → "John Smith"
- `{SSN_1}` → "123-45-6789"
- `{EMAIL_2}` → "user@example.com"

#### Masking Process

```typescript
mask(value: string | null, category: PiiCategory): string | null {
  if (!this.shouldMask(category)) {
    return value; // Not masking this category
  }
  
  // Check for existing token
  for (const [token, existingValue] of categoryMap.entries()) {
    if (existingValue === value) {
      return token; // Reuse token for same value
    }
  }
  
  // Create new token
  const token = `{${category}_${counter}}`;
  categoryMap.set(token, value);
  return token;
}
```

#### Token Lifecycle

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  DOM Field  │ -> │ PII Masker   │ -> │  Token Map  │
│  "John"     │    │ {NAME_1}     │    │ (Memory)    │
└─────────────┘    └──────────────┘    └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ LLM Request │
                                        │ {NAME_1}    │
                                        └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ LLM Response│
                                        │ "Update     │
                                        │  {NAME_1}"  │
                                        └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ Resolution  │
                                        │ "Update     │
                                        │  John"      │
                                        └─────────────┘
```

**Key Properties:**
- **In-Memory Only**: Token maps never persisted to disk
- **Session Isolated**: Separate token map per browser tab
- **Deterministic**: Same value always gets same token
- **Reversible**: Tokens resolved only at action execution time
- **Auto-Cleanup**: Maps cleared on tab/session close

### 2.4 Session Isolation

Each browser tab maintains its own isolated token map:

```typescript
class PIIMasker {
  private tokenMaps: Map<string, Map<string, string>> = new Map();
  
  clearSession(): void {
    this.tokenMaps.clear();
    this.counters.clear();
  }
}
```

**Isolation Guarantees:**
- Token maps never shared across tabs
- Session closure automatically clears maps
- No persistence in chrome.storage
- No cross-tab token resolution

### 2.5 Masking Enforcement Points

PII masking is enforced at **4 critical checkpoints**:

1. **DOM Snapshot Creation** (`dom-observer.ts`)
   ```typescript
   const maskedFields = piiMasker.maskFields(parsedFields);
   ```

2. **LLM Request Preparation** (`service-worker/llm-client.ts`)
   ```typescript
   const maskedContext = maskPII(context);
   ```

3. **Audit Logging** (`shared/audit-logger.ts`)
   ```typescript
   // Never logs raw PII, only tokens
   logCommandReceived(command: string, caseId: string | null)
   ```

4. **Storage Operations** (`service-worker/session-store.ts`)
   ```typescript
   // chrome.storage.session contains only masked tokens
   ```

---

## 3. Data Flow Security

### 3.1 Data That Leaves the Browser

✅ **SAFE to Transmit:**
- PII tokens (`{NAME_1}`, `{SSN_2}`, etc.)
- Masked field values
- Case IDs and metadata
- Intent classifications
- Action plans (with tokens)
- Audit entries (with tokens)

❌ **NEVER Transmitted:**
- Raw PII values (names, SSNs, emails, etc.)
- Pega authentication tokens
- Session cookies
- Passwords
- Unmasked field values
- Full DOM snapshots

### 3.2 Data That Stays Local

✅ **Browser-Local Only:**
- Token → PII mappings (in-memory only)
- Pega authentication credentials
- Session state
- Raw DOM snapshots
- User preferences

### 3.3 Data Flow Diagram

```
User Input (Plain)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ Content Script: PII Masker                          │
│ "John Smith" → "{NAME_1}"                           │
└─────────────────────────────────────────────────────┘
    │
    │ Masked Data Only
    ▼
┌─────────────────────────────────────────────────────┐
│ Service Worker: Session Store                       │
│ chrome.storage.session (tokens only)                │
└─────────────────────────────────────────────────────┘
    │
    │ Masked Data Only
    ▼
┌─────────────────────────────────────────────────────┐
│ LLM API Request                                     │
│ "Update {NAME_1} to {NAME_2}"                       │
└─────────────────────────────────────────────────────┘
    │
    │ Masked Response
    ▼
┌─────────────────────────────────────────────────────┐
│ Content Script: Token Resolution                    │
│ "{NAME_1}" → "John Smith"                           │
└─────────────────────────────────────────────────────┘
    │
    ▼
DOM Execution (Plain Values)
```

### 3.4 Masking Enforcement Guarantees

1. **First-Line Defense**: PII Masker runs before any external transmission
2. **No Bypass**: All data paths pass through masker
3. **Fail-Safe**: Masking errors default to masking
4. **Audit Verification**: Audit logs verify masking occurred

---

## 4. Extension Security

### 4.1 Manifest V3 Security Features

**Location:** `manifest.json`

```json
{
  "manifest_version": 3,
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "sidePanel"
  ],
  "host_permissions": ["<all_urls>"]
}
```

**Security Hardening:**

1. **CSP Restrictions**
   - No remote code execution
   - No eval() (except WASM)
   - No inline scripts
   - Same-origin policy enforced

2. **Minimal Permissions**
   - `activeTab`: Only active tab access
   - `scripting`: Dynamic script injection
   - `storage`: Extension storage only
   - `sidePanel`: UI rendering

3. **Host Permissions**
   - `<all_urls>`: Required for Pega detection
   - No special API access (webRequest, etc.)

### 4.2 Service Worker Isolation

**Trusted Boundary:**
- All message routing passes through service worker
- No direct content script ↔ LLM communication
- Service worker validates all messages
- Type-safe message protocol (`message-types.ts`)

```typescript
// Type-safe message validation
export function isValidMessage(message: unknown): message is Message {
  if (!message || typeof message !== 'object') return false;
  const msg = message as Partial<Message>;
  if (!msg.type || !Object.values(MessageType).includes(msg.type)) {
    return false;
  }
  return true;
}
```

### 4.3 No Pega Auth Access

**Explicitly NOT Accessed:**
- Pega authentication cookies
- Authorization headers
- Session tokens
- Login credentials

**Architecture Decision:**
The extension operates as a **client-side assistant** only. It:
- Reads visible DOM data
- Interacts with form fields
- Never accesses Pega backend APIs
- Never sees authentication tokens

---

## 5. LLM Security

### 5.1 API Key Storage

**Storage Location:** `chrome.storage.local` (encrypted by Chrome)

```typescript
// Enterprise configuration with API keys
interface LLMConfig {
  provider: LLMProvider;
  endpoint: string;
  model: string;
  apiKey?: string; // Stored securely in chrome.storage.local
}
```

**Security Properties:**
- Keys never logged or transmitted in plain text
- Keys isolated per extension instance
- Keys accessible only to service worker
- No key exposure to content scripts

### 5.2 Provider Authentication

**Supported Providers:**
- Azure OpenAI
- OpenAI
- Anthropic
- Google
- Mistral
- Local models

**Authentication Flow:**
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Enterprise   │ -> │ chrome.storage│ -> │ LLM API      │
│ Config       │    │ .local        │    │ Request      │
│ (API Key)    │    │ (Encrypted)   │    │ (Bearer)     │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 5.3 Prompt Injection Prevention

**Defensive Measures:**

1. **Input Sanitization**
   ```typescript
   // Sanitize user commands before LLM
   const sanitized = command
     .replace(/<script>/gi, '')
     .replace(/javascript:/gi, '')
     .substring(0, 5000); // Length limit
   ```

2. **Structured Prompts**
   - System prompts hardcoded
   - User input clearly delimited
   - No prompt concatenation

3. **Output Validation**
   - Parse LLM response as JSON
   - Validate against schema
   - Reject malformed responses
   - Type-safe action plan parsing

4. **Instruction Injection Prevention**
   ```typescript
   // Never execute arbitrary code from LLM
   // Only execute validated ActionPlan steps
   if (isValidActionPlan(llmResponse)) {
     await executePlan(llmResponse);
   } else {
     throw new PlanParseError('Invalid LLM response');
   }
   ```

### 5.4 Output Validation

**Validation Layers:**

1. **Schema Validation**
   ```typescript
   interface ActionPlan {
     planId: string;
     intent: IntentType;
     summary: string;
     steps: PlanStep[];
     expectedOutcome: string;
   }
   ```

2. **Type Guards**
   ```typescript
   function isValidActionPlan(obj: unknown): obj is ActionPlan {
     // Runtime type checking
     return (
       typeof obj === 'object' &&
       'planId' in obj &&
       'steps' in obj &&
       Array.isArray(obj.steps)
     );
   }
   ```

3. **Selector Validation**
   ```typescript
   // Validate CSS selectors before execution
   try {
     document.querySelector(step.selector);
   } catch {
     throw new SelectorNotFoundError(step.selector);
   }
   ```

4. **Action Restrictions**
   - Only whitelisted action types
   - No arbitrary JavaScript execution
   - No native alerts or confirm dialogs
   - No access to chrome.* APIs from content scripts

---

## 6. Audit Trail

### 6.1 What Gets Logged

**Location:** `src/shared/audit-logger.ts`

**Event Types:**
```typescript
type AuditEventType =
  | 'PEGA_DETECTED'
  | 'CASE_OPENED'
  | 'SUMMARY_GENERATED'
  | 'COMMAND_RECEIVED'
  | 'INTENT_CLASSIFIED'
  | 'PLAN_GENERATED'
  | 'PLAN_CONFIRMED'
  | 'PLAN_CANCELLED'
  | 'PLAN_EXECUTED'
  | 'PLAN_STEP_FAILED'
  | 'FEEDBACK_RECEIVED';
```

**Audit Entry Structure:**
```typescript
interface AuditEntry {
  entryId: string;
  timestamp: string;
  sessionId: string;
  userId: string | null;
  caseId: string | null;
  eventType: string;
  intent: IntentType | null;
  planSummary: string | null;  // Masked
  stepCount: number | null;
  outcome: OutcomeType | null;
  errorMessage: string | null;
}
```

### 6.2 Logging Format

**Example Audit Entry:**
```json
{
  "entryId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-05-10T14:30:00.000Z",
  "sessionId": "session-123",
  "userId": null,
  "caseId": "CASE-123",
  "eventType": "PLAN_EXECUTED",
  "intent": "UPDATE_FIELD",
  "planSummary": "Update {NAME_1} to {NAME_2}",
  "stepCount": 3,
  "outcome": "success",
  "errorMessage": null
}
```

### 6.3 Retention Policy

**Storage Locations:**
1. **In-Memory**: Last 500 entries (FIFO eviction)
2. **chrome.storage.session**: Cleared on browser close
3. **Backend (Optional)**: Configurable endpoint

**Retention:**
- Default: 500 entries per session
- Max entries: Configurable via `maxEntries`
- Session-scoped: Auto-clears on browser close
- No long-term storage in extension

### 6.4 Access Controls

**Read Access:**
- Service worker only
- No content script access
- User can view via extension UI

**Write Access:**
- Service worker only
- Immutable once written
- No delete API (only clear all)

**Transmission:**
- Optional backend sync
- Requires auth token
- Never includes raw PII

---

## 7. Compliance

### 7.1 HIPAA Considerations

**Protected Health Information (PHI):**
- The extension may access PHI in Pega case fields
- PHI is classified as PII and tokenized
- Tokens never transmitted with raw values

**HIPAA Safeguards:**

1. **Administrative Safeguards**
   - Audit logging for all PHI access
   - Session tracking for user actions
   - Configurable role-based access

2. **Physical Safeguards**
   - Data stays in user's browser
   - No cloud storage of raw PHI
   - In-memory token maps only

3. **Technical Safeguards**
   - PII tokenization before transmission
   - No Pega auth access
   - Encrypted storage (Chrome-managed)

**HIPAA Recommendations:**
- Enable audit logging for healthcare deployments
- Use `localProcessingOnly: true` for PHI workloads
- Implement custom backend for audit trail retention
- Configure role restrictions for PHI access

### 7.2 GDPR Considerations

**Data Subject Rights:**

1. **Right to Access**
   - Users can view audit logs via extension UI
   - Export functionality for session data

2. **Right to Erasure**
   - Clear session data on browser close
   - Manual clear via extension settings
   - No long-term data retention

3. **Right to Rectification**
   - Token maps cleared on session end
   - No persistent PII storage

4. **Right to Portability**
   - Audit logs exportable (JSON format)
   - Session data exportable

**GDPR Safeguards:**
- Data minimization (only PII transmitted as tokens)
- Purpose limitation (LLM processing only)
- Storage limitation (session-scoped only)
- Integrity and confidentiality (tokenization)

### 7.3 Enterprise Deployment Notes

**Security Configuration:**

```typescript
interface SecurityConfig {
  piiMaskingEnabled: boolean;           // Always true
  piiCategoriesToMask: string[];        // All 8 categories
  localProcessingOnly: boolean;         // For PHI/PCI
  allowedLLMProviders: string[];        // Whitelist
  auditLoggingEnabled: boolean;         // Always true
  requireConfirmationForAllActions: boolean;
  disabledCapabilities: IntentType[];   // Role restrictions
}
```

**Enterprise Recommendations:**

1. **For Healthcare (HIPAA)**
   ```json
   {
     "piiMaskingEnabled": true,
     "localProcessingOnly": true,
     "auditLoggingEnabled": true,
     "allowedLLMProviders": ["azure-openai"],
     "requireConfirmationForAllActions": true
   }
   ```

2. **For Finance (PCI)**
   ```json
   {
     "piiCategoriesToMask": ["ACCOUNT", "SSN", "NAME", "DOB"],
     "auditLoggingEnabled": true,
     "requireConfirmationForAllActions": true,
     "disabledCapabilities": ["DELETE", "ESCALATE"]
   }
   ```

3. **For Government (FedRAMP)**
   ```json
   {
     "allowedLLMProviders": ["azure-openai"],
     "auditLoggingEnabled": true,
     "piiMaskingEnabled": true,
     "requireConfirmationForAllActions": true
   }
   ```

---

## 8. Security Best Practices

### 8.1 Recommended Configurations

**Production Deployment:**

```typescript
const enterpriseConfig: EnterpriseConfig = {
  version: "1.0.0",
  security: {
    piiMaskingEnabled: true,
    piiCategoriesToMask: ["NAME", "SSN", "DOB", "EMAIL", "PHONE", "ACCOUNT", "ADDRESS", "INCOME"],
    localProcessingOnly: false,  // Set to true for PHI
    allowedLLMProviders: ["azure-openai", "anthropic"],
    auditLoggingEnabled: true,
    requireConfirmationForAllActions: true,
    disabledCapabilities: []
  },
  llm: {
    provider: "azure-openai",
    endpoint: "https://your-instance.openai.azure.com",
    model: "gpt-4",
    maxTokens: 2000,
    temperature: 0.7
  },
  pega: {
    targetDomains: ["*.pega.com", "your-domain.com"],
    useDirectAPI: false
  },
  roleRestrictions: {
    "caseworker": ["*"],
    "manager": ["*"],
    "viewer": ["SUMMARIZE_CASE", "SHOW_QUEUE", "EXPLAIN"]
  }
};
```

### 8.2 Security Do's and Don'ts

**DO:**
✅ Enable PII masking for all deployments  
✅ Use Azure OpenAI for enterprise deployments  
✅ Enable audit logging  
✅ Require confirmation for destructive actions  
✅ Configure role-based access control  
✅ Use HTTPS for all API endpoints  
✅ Review audit logs regularly  
✅ Implement rate limiting for LLM calls  
✅ Test token resolution before deployment  
✅ Keep extension updated  

**DON'T:**
❌ Disable PII masking  
❌ Transmit raw PII to LLMs  
❌ Store API keys in source code  
❌ Use `eval()` or dynamic code execution  
❌ Access Pega authentication tokens  
❌ Log sensitive data in plain text  
❌ Disable audit logging in production  
❌ Use untrusted LLM providers  
❌ Share token maps across sessions  
❌ Expose service worker to content scripts  

### 8.3 Incident Response

**Security Incident Categories:**

1. **PII Exposure**
   - Symptoms: Raw PII in logs or LLM requests
   - Response: Immediately disable extension
   - Investigation: Check masking configuration
   - Prevention: Review masking patterns

2. **Unauthorized Actions**
   - Symptoms: Actions executed without user consent
   - Response: Disable auto-confirmation
   - Investigation: Review audit logs
   - Prevention: Enable confirmations

3. **API Key Compromise**
   - Symptoms: Unexpected LLM usage
   - Response: Rotate API keys
   - Investigation: Check chrome.storage.local
   - Prevention: Use key management service

4. **Audit Trail Tampering**
   - Symptoms: Missing audit entries
   - Response: Enable backend sync
   - Investigation: Check storage quotas
   - Prevention: Monitor audit logs

**Incident Response Plan:**

```
1. Detection → Audit log review, user reports
2. Containment → Disable extension, rotate keys
3. Eradication → Patch vulnerabilities
4. Recovery → Restore from known good state
5. Lessons Learned → Update security docs
```

---

## 9. Security Testing

### 9.1 Test Coverage

**PII Masking Tests:** `tests/unit/pii-masker.test.ts`
- Classification accuracy
- Token generation uniqueness
- Token resolution correctness
- Session isolation

**Intent Classification Tests:** `tests/unit/intent-classifier.test.ts`
- Prompt injection resistance
- Input validation
- Output sanitization

**Security Test Cases:**
```typescript
describe('PII Masking', () => {
  it('should mask all 8 PII categories', () => {
    const categories = ['NAME', 'SSN', 'DOB', 'EMAIL', 'PHONE', 'ACCOUNT', 'ADDRESS', 'INCOME'];
    categories.forEach(category => {
      expect(masker.classify(category, category)).toBe(category);
    });
  });
  
  it('should generate unique tokens per value', () => {
    const token1 = masker.mask('John', 'NAME');
    const token2 = masker.mask('Jane', 'NAME');
    expect(token1).not.toBe(token2);
  });
  
  it('should reuse tokens for same value', () => {
    const token1 = masker.mask('John', 'NAME');
    const token2 = masker.mask('John', 'NAME');
    expect(token1).toBe(token2);
  });
});
```

### 9.2 Penetration Testing

**Recommended Test Scenarios:**

1. **PII Extraction**
   - Attempt to extract raw PII from LLM responses
   - Try to bypass tokenization
   - Test token resolution exploits

2. **Prompt Injection**
   - Inject system prompts in user commands
   - Attempt to expose system context
   - Try to manipulate action plans

3. **Authorization Bypass**
   - Attempt actions outside role permissions
   - Test confirmation bypasses
   - Try to execute disabled capabilities

4. **Data Exfiltration**
   - Monitor network traffic for PII
   - Check chrome.storage for raw data
   - Verify no PII in audit logs

---

## 10. Security References

### 10.1 Documentation

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Browser Security](https://owasp.org/www-community/attacks/Browser_Security)
- [Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)
- [Manifest V3 Security](https://developer.chrome.com/docs/extensions/mv3/intro/#manifest-v3)

### 10.2 Compliance Standards

- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [GDPR Text](https://gdpr-info.eu/)
- [FedRAMP Security Controls](https://www.fedramp.gov/assets/resources/documents/FedRAMP_Security_Controls_Baseline.pdf)
- [PCI DSS](https://www.pcisecuritystandards.org/documents/PCI_DSS_v3-2-1.pdf)

### 10.3 Security Tools

- **Static Analysis**: ESLint security plugins
- **Dependency Scanning**: npm audit
- **Penetration Testing**: OWASP ZAP
- **Code Review**: Manual security reviews

---

## Appendix A: Security Checklist

### Deployment Checklist

- [ ] PII masking enabled for all 8 categories
- [ ] Audit logging enabled and configured
- [ ] API keys stored in chrome.storage.local
- [ ] Role-based access control configured
- [ ] HTTPS only for all endpoints
- [ ] Rate limiting configured for LLM calls
- [ ] Confirmation required for destructive actions
- [ ] Token resolution tested in target environment
- [ ] Audit log retention policy defined
- [ ] Incident response plan documented
- [ ] Security training completed for developers
- [ ] Penetration testing performed
- [ ] Compliance review completed (HIPAA/GDPR)

---

## Appendix B: Contact Information

**Security Questions:** security@example.com  
**Vulnerability Reporting:** Please use responsible disclosure  
**Documentation:** https://github.com/your-org/pega-agent  

---

**Document Classification:** Confidential  
**Distribution:** Need-to-know basis only  
**Version Control:** Maintained in git repository  
**Review Cycle:** Quarterly or after security incidents  

---

*This security document is a living document. Please report any security concerns or suggestions to the security team immediately.*