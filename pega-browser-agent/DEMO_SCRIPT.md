# Pega Browser Agent Demo Script

## Demo Walkthrough Guide

### Prerequisites
1. Chrome browser with extension loaded
2. Open the demo page: `chrome-extension://[extension-id]/public/demo.html`
3. Side panel open

---

## Demo Commands to Try

### 1. Case Summarization (10 seconds)

**Command:** `Summarize this case`

**Expected Result:**
The agent generates a summary like:

```json
{
  "situation": "Jennifer Martinez is applying for a $25,000 personal loan for debt consolidation",
  "history": "Case opened 2 days ago, passed Intake and Review stages",
  "currentState": "In Underwriting stage - all required documents submitted, awaiting credit verification",
  "riskSignals": [
    "SSN shows masked value - verify full SSN before approval",
    "Credit score (720) is good but verify employment stability"
  ],
  "recommendedNextAction": "Approve loan with standard interest rate - applicant meets all criteria"
}
```

**What to highlight in demo:**
- PII masking (SSN, DOB, Income are tokenized)
- Structured output with risk signals
- Actionable recommendation

---

### 2. Intent Classification (5 seconds each)

Try these commands and observe the classification:

| Command | Expected Intent | LLM Required |
|---------|-----------------|--------------|
| "Summarize this case" | SUMMARIZE_CASE | No (local) |
| "Submit" | SUBMIT_CASE | No (local) |
| "Save" | SAVE_CASE | No (local) |
| "Next" | NEXT_STEP | No (local) |
| "Update status to approved" | UPDATE_FIELD | Yes |
| "Create a new mortgage application" | CREATE_CASE | Yes |
| "Find cases with high priority" | SEARCH | Yes |
| "Why is this case in underwriting?" | EXPLAIN | Yes |

**What to highlight:**
- Local intents are instant (no LLM call)
- Complex intents use LLM
- Confidence scores

---

### 3. Form Automation (15 seconds)

**Command:** `Update notes to say "Verified income documentation. Ready for approval."`

**Expected Flow:**
1. Agent creates action plan:
   ```
   Step 1: TYPE into [data-test-id="Field_Notes"]
   Value: "Verified income documentation. Ready for approval."
   ```
2. Plan shown for confirmation
3. User clicks "Confirm"
4. Agent executes using native input setters
5. Pega change detection triggered

**What to highlight:**
- Plan confirmation for transparency
- Native input setter for Pega compatibility
- De-tokenization happens only at execution time

---

### 4. Action Buttons (5 seconds each)

**Command:** `Submit this case`

**Expected Flow:**
1. Agent identifies Submit button: `[data-test-id="Action_Submit"]`
2. Creates simple plan: CLICK on Submit button
3. Executes after confirmation

**Alternative commands:**
- "Save draft"
- "Next step"
- "Reassign to supervisor"

---

### 5. Multi-Provider Fallback (20 seconds)

**Simulate provider failure:**
1. Configure multiple providers in settings
2. Primary provider fails
3. Agent automatically tries next provider

**Demo setup:**
```
Provider 1: Anthropic (priority 1) - invalid key
Provider 2: OpenAI (priority 2) - valid key
```

**What to highlight:**
- Automatic fallback on failure
- Priority-based provider selection
- Error aggregation if all fail

---

### 6. PII Masking Demo (10 seconds)

**Show the tokenization:**

Input fields with PII:
- SSN: `123-45-6789` → Token: `{SSN_1}`
- DOB: `04/15/1985` → Token: `{DOB_1}`
- Email: `jennifer.martinez@email.com` → Token: `{EMAIL_1}`
- Income: `$85,000` → Token: `{INCOME_1}`

**What gets sent to LLM:**
```json
{
  "caseId": "LOAN-2024-001234",
  "fields": [
    { "label": "First Name", "value": "{NAME_1}" },
    { "label": "SSN", "value": "{SSN_1}" },
    { "label": "Annual Income", "value": "{INCOME_1}" }
  ]
}
```

**What to highlight:**
- Raw values never leave the browser
- Tokens are resolved only during execution
- Session isolation between tabs

---

### 7. Error Handling (10 seconds)

**Simulate errors:**

1. **Element not found:**
   Command: `Update nonexistent field to test`
   Result: Graceful error message

2. **LLM timeout:**
   Result: Automatic retry with next provider

3. **Invalid action:**
   Command: `Delete this case`
   Result: "Action not supported" message

---

## Demo Recording Tips

### Screen Recording Setup

1. **Browser window:** 1440x900 resolution
2. **Show:** Demo page + Side panel
3. **Hide:** Browser bookmarks bar, unnecessary UI

### Recording Sequence

```
0:00-0:15 - Intro overlay
0:15-0:30 - Click robot icon, show side panel
0:30-0:45 - Type "Summarize this case"
0:45-1:00 - Show generated summary
1:00-1:15 - Type "What should I do next?"
1:15-1:30 - Show recommendation
1:30-2:00 - Form automation demo
2:00-2:30 - PII masking explanation
2:30-3:00 - Multi-provider fallback
3:00-3:30 - Error handling
3:30-4:00 - Closing and call-to-action
```

### Voiceover Script

```
[0:00] "The Pega Browser Agent is an AI-powered assistant that helps
       case workers be more productive in Pega Infinity."

[0:15] "Let's see it in action. Click the robot icon to open
       the side panel."

[0:30] "Type 'Summarize this case' to get an instant overview
       of the current case."

[0:45] "Notice how the agent provides situation, history,
       risk signals, and recommended actions."

[1:30] "Behind the scenes, sensitive data like SSN and income
       is automatically masked before being sent to the AI."

[2:30] "Multiple LLM providers are supported with automatic
       fallback for reliability."

[3:30] "The Pega Browser Agent - your intelligent co-pilot
       for case management."
```

---

## Performance Metrics to Show

| Metric | Value | Description |
|--------|-------|-------------|
| Local Intent Classification | <10ms | Regex-based, no network |
| LLM Response Time | 1-3s | Depends on provider |
| PII Masking | <5ms | In-memory tokenization |
| Action Execution | 300ms | Includes step delay |
| End-to-end (local intent) | <500ms | Classification + execution |
| End-to-end (LLM intent) | 2-4s | LLM call + execution |

---

## Files Generated

- `demo.html` - Simulated Pega Infinity page
- `DEMO_SCRIPT.md` - This walkthrough guide
- Icons: `icon16.png`, `icon48.png`, `icon128.png`

---

## Demo Checklist

Before recording:
- [ ] Extension loaded in Chrome
- [ ] Demo page accessible
- [ ] At least one LLM provider configured with valid API key
- [ ] Side panel opens correctly
- [ ] All commands tested manually

After recording:
- [ ] Edit out any API keys visible
- [ ] Add voiceover or captions
- [ ] Include call-to-action at end
- [ ] Export in 1080p or higher
