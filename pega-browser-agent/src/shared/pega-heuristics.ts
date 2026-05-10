/**
 * Pega Heuristics - Comprehensive Domain Knowledge for Pega Infinity
 *
 * Encodes Pega-specific patterns for:
 * - Field PII classification and semantic meaning
 * - Case class domain identification
 * - Action button semantic classification
 * - Pega UI framework detection (Constellation, Classic, Cosmos)
 * - Case lifecycle patterns (stages, processes, steps)
 * - Work object and class hierarchy patterns
 * - Assignment and routing patterns
 * - SLA and deadline patterns
 * - Correspondence and notification patterns
 * - Data page and property patterns
 * - Flow and connector patterns
 * - Decision rule patterns
 * - Integration patterns
 * - Portal and dashboard patterns
 * - Error and validation patterns
 * - Pega API patterns
 */

import type { PiiCategory, ActionType, UIFramework } from './types';

// ============================================================================
// PEGA VERSION PATTERNS
// ============================================================================

export const PEGA_VERSION_PATTERNS = {
  infinity23: /Pega.*?(?:23|8\.[89])/i,
  infinity24: /Pega.*?(?:24|Infinity)/i,
  classicVersion: /PRPC|Pega\s*[67]/i,
};

// ============================================================================
// FIELD PII PATTERNS - Comprehensive
// ============================================================================

export interface FieldPattern {
  pattern: RegExp;
  piiCategory: PiiCategory;
  semantic: string;
  pegaPropertyType?: string;
}

export const FIELD_PII_PATTERNS: FieldPattern[] = [
  // ============================================================================
  // PERSONAL IDENTIFICATION
  // ============================================================================
  // Name patterns
  { pattern: /first.?name|fname|given.?name|forename/i, piiCategory: 'NAME', semantic: 'person.firstName', pegaPropertyType: 'Text' },
  { pattern: /last.?name|lname|surname|family.?name/i, piiCategory: 'NAME', semantic: 'person.lastName', pegaPropertyType: 'Text' },
  { pattern: /middle.?name|mname|middle.?initial/i, piiCategory: 'NAME', semantic: 'person.middleName', pegaPropertyType: 'Text' },
  { pattern: /full.?name|customer.?name|client.?name|member.?name/i, piiCategory: 'NAME', semantic: 'person.fullName', pegaPropertyType: 'Text' },
  { pattern: /contact.?name|applicant.?name|insured.?name|subscriber.?name/i, piiCategory: 'NAME', semantic: 'person.contactName', pegaPropertyType: 'Text' },
  { pattern: /beneficiary.?name|dependent.?name|spouse.?name/i, piiCategory: 'NAME', semantic: 'person.relatedName', pegaPropertyType: 'Text' },
  { pattern: /maiden.?name|former.?name|alias/i, piiCategory: 'NAME', semantic: 'person.aliasName', pegaPropertyType: 'Text' },
  { pattern: /employer.?name|company.?name|business.?name|organization.?name/i, piiCategory: 'NAME', semantic: 'organization.name', pegaPropertyType: 'Text' },
  { pattern: /physician.?name|doctor.?name|provider.?name|physician/i, piiCategory: 'NAME', semantic: 'healthcare.providerName', pegaPropertyType: 'Text' },

  // SSN/Tax ID patterns
  { pattern: /ssn|social.?security|tax.?id|tin|taxpayer/i, piiCategory: 'SSN', semantic: 'person.ssn', pegaPropertyType: 'Text' },
  { pattern: /national.?id|government.?id|ein|fein|federal.?id/i, piiCategory: 'SSN', semantic: 'person.nationalId', pegaPropertyType: 'Text' },
  { pattern: /passport.?num|passport.?id|passport/i, piiCategory: 'SSN', semantic: 'person.passport', pegaPropertyType: 'Text' },
  { pattern: /driver.?licen[cs]e|dl.?num|license.?num/i, piiCategory: 'SSN', semantic: 'person.driverLicense', pegaPropertyType: 'Text' },
  { pattern: /alien.?num|a.?num|uscis|immigration/i, piiCategory: 'SSN', semantic: 'person.alienNumber', pegaPropertyType: 'Text' },
  { pattern: /itin|individual.?taxpayer/i, piiCategory: 'SSN', semantic: 'person.itin', pegaPropertyType: 'Text' },
  { pattern: /npi|national.?provider.?id/i, piiCategory: 'SSN', semantic: 'healthcare.npi', pegaPropertyType: 'Text' },
  { pattern: /dea.?num|dea.?license/i, piiCategory: 'SSN', semantic: 'healthcare.deaNumber', pegaPropertyType: 'Text' },
  { pattern: /medicare.?id|medicaid.?id|hic.?num/i, piiCategory: 'SSN', semantic: 'healthcare.medicareId', pegaPropertyType: 'Text' },

  // Date of birth patterns
  { pattern: /date.?of.?birth|dob|birth.?date|birthdate/i, piiCategory: 'DOB', semantic: 'person.dob', pegaPropertyType: 'Date' },
  { pattern: /birthday|born.?on|date.?born/i, piiCategory: 'DOB', semantic: 'person.dob', pegaPropertyType: 'Date' },
  { pattern: /death.?date|date.?of.?death|deceased.?date/i, piiCategory: 'DOB', semantic: 'person.deathDate', pegaPropertyType: 'Date' },

  // Gender/Sex
  { pattern: /^gender$|^sex$|gender.?code|sex.?code/i, piiCategory: null, semantic: 'person.gender', pegaPropertyType: 'Text' },
  { pattern: /marital.?status/i, piiCategory: null, semantic: 'person.maritalStatus', pegaPropertyType: 'Text' },

  // ============================================================================
  // CONTACT INFORMATION
  // ============================================================================
  // Email patterns
  { pattern: /email|e-mail|email.?address|email.?id/i, piiCategory: 'EMAIL', semantic: 'contact.email', pegaPropertyType: 'Text' },
  { pattern: /work.?email|business.?email|corp.?email/i, piiCategory: 'EMAIL', semantic: 'contact.workEmail', pegaPropertyType: 'Text' },
  { pattern: /alternate.?email|secondary.?email/i, piiCategory: 'EMAIL', semantic: 'contact.alternateEmail', pegaPropertyType: 'Text' },

  // Phone patterns
  { pattern: /phone|telephone|contact.?number|phone.?num/i, piiCategory: 'PHONE', semantic: 'contact.phone', pegaPropertyType: 'PhoneNumber' },
  { pattern: /mobile|cell|cell.?phone|cellular/i, piiCategory: 'PHONE', semantic: 'contact.mobile', pegaPropertyType: 'PhoneNumber' },
  { pattern: /work.?phone|business.?phone|office.?phone/i, piiCategory: 'PHONE', semantic: 'contact.workPhone', pegaPropertyType: 'PhoneNumber' },
  { pattern: /home.?phone|residence.?phone|evening.?phone/i, piiCategory: 'PHONE', semantic: 'contact.homePhone', pegaPropertyType: 'PhoneNumber' },
  { pattern: /fax|fax.?number|facsimile/i, piiCategory: 'PHONE', semantic: 'contact.fax', pegaPropertyType: 'PhoneNumber' },
  { pattern: /pager|beeper/i, piiCategory: 'PHONE', semantic: 'contact.pager', pegaPropertyType: 'PhoneNumber' },

  // ============================================================================
  // ADDRESS INFORMATION
  // ============================================================================
  { pattern: /street.?address|address.?line|street.?line|address1|address2/i, piiCategory: 'ADDRESS', semantic: 'location.streetAddress', pegaPropertyType: 'Text' },
  { pattern: /city|town|municipality/i, piiCategory: 'ADDRESS', semantic: 'location.city', pegaPropertyType: 'Text' },
  { pattern: /^state$|state.?code|province|region/i, piiCategory: 'ADDRESS', semantic: 'location.state', pegaPropertyType: 'Text' },
  { pattern: /zip|postal.?code|zipcode|zip.?code/i, piiCategory: 'ADDRESS', semantic: 'location.postalCode', pegaPropertyType: 'Text' },
  { pattern: /country|country.?code|nation/i, piiCategory: 'ADDRESS', semantic: 'location.country', pegaPropertyType: 'Text' },
  { pattern: /mailing.?address|billing.?address/i, piiCategory: 'ADDRESS', semantic: 'location.mailingAddress', pegaPropertyType: 'Text' },
  { pattern: /residential.?address|home.?address|physical.?address/i, piiCategory: 'ADDRESS', semantic: 'location.residentialAddress', pegaPropertyType: 'Text' },
  { pattern: /previous.?address|former.?address/i, piiCategory: 'ADDRESS', semantic: 'location.previousAddress', pegaPropertyType: 'Text' },
  { pattern: /property.?address|location.?address|site.?address/i, piiCategory: 'ADDRESS', semantic: 'location.propertyAddress', pegaPropertyType: 'Text' },
  { pattern: /county|parish|borough/i, piiCategory: 'ADDRESS', semantic: 'location.county', pegaPropertyType: 'Text' },

  // ============================================================================
  // FINANCIAL INFORMATION
  // ============================================================================
  // Account patterns
  { pattern: /account.?num|acct.?num|account.?id|account.?no/i, piiCategory: 'ACCOUNT', semantic: 'financial.accountNumber', pegaPropertyType: 'Text' },
  { pattern: /routing.?num|aba|routing.?number|transit.?num/i, piiCategory: 'ACCOUNT', semantic: 'financial.routingNumber', pegaPropertyType: 'Text' },
  { pattern: /card.?num|credit.?card|debit.?card|card.?number|pan/i, piiCategory: 'ACCOUNT', semantic: 'financial.cardNumber', pegaPropertyType: 'Text' },
  { pattern: /cvv|cvv2|security.?code|card.?code/i, piiCategory: 'ACCOUNT', semantic: 'financial.cardSecurityCode', pegaPropertyType: 'Text' },
  { pattern: /policy.?num|policy.?id|policy.?number/i, piiCategory: 'ACCOUNT', semantic: 'financial.policyNumber', pegaPropertyType: 'Text' },
  { pattern: /claim.?num|claim.?id|claim.?number/i, piiCategory: 'ACCOUNT', semantic: 'financial.claimNumber', pegaPropertyType: 'Text' },
  { pattern: /loan.?num|loan.?id|mortgage.?num/i, piiCategory: 'ACCOUNT', semantic: 'financial.loanNumber', pegaPropertyType: 'Text' },
  { pattern: /case.?num|case.?id|ticket.?num|reference.?num/i, piiCategory: 'ACCOUNT', semantic: 'case.caseNumber', pegaPropertyType: 'Text' },
  { pattern: /iban|international.?bank.?account/i, piiCategory: 'ACCOUNT', semantic: 'financial.iban', pegaPropertyType: 'Text' },
  { pattern: /swift|bic|swift.?code/i, piiCategory: 'ACCOUNT', semantic: 'financial.swiftCode', pegaPropertyType: 'Text' },
  { pattern: /wire.?transfer|aba.?num/i, piiCategory: 'ACCOUNT', semantic: 'financial.wireInfo', pegaPropertyType: 'Text' },

  // Income patterns
  { pattern: /income|salary|annual.?income|monthly.?income/i, piiCategory: 'INCOME', semantic: 'financial.income', pegaPropertyType: 'Currency' },
  { pattern: /gross.?income|net.?income|household.?income/i, piiCategory: 'INCOME', semantic: 'financial.grossIncome', pegaPropertyType: 'Currency' },
  { pattern: /wages|compensation|earnings|pay.?rate/i, piiCategory: 'INCOME', semantic: 'financial.wages', pegaPropertyType: 'Currency' },
  { pattern: /bonus|commission|tips|overtime/i, piiCategory: 'INCOME', semantic: 'financial.additionalIncome', pegaPropertyType: 'Currency' },
  { pattern: /net.?worth|assets|liabilities/i, piiCategory: 'INCOME', semantic: 'financial.netWorth', pegaPropertyType: 'Currency' },

  // Financial amounts (non-PII)
  { pattern: /amount|balance|total|subtotal/i, piiCategory: null, semantic: 'financial.amount', pegaPropertyType: 'Currency' },
  { pattern: /payment.?amount|premium|deductible|co.?pay/i, piiCategory: null, semantic: 'financial.paymentAmount', pegaPropertyType: 'Currency' },
  { pattern: /loan.?amount|principal|interest.?rate/i, piiCategory: null, semantic: 'financial.loanAmount', pegaPropertyType: 'Currency' },
  { pattern: /coverage.?amount|limit|sum.?insured/i, piiCategory: null, semantic: 'financial.coverageAmount', pegaPropertyType: 'Currency' },

  // ============================================================================
  // HEALTHCARE SPECIFIC
  // ============================================================================
  { pattern: /medical.?record.?num|mrn|patient.?id|empi/i, piiCategory: 'ACCOUNT', semantic: 'healthcare.medicalRecordNumber', pegaPropertyType: 'Text' },
  { pattern: /diagnosis.?code|icd.?code|icd.?10/i, piiCategory: null, semantic: 'healthcare.diagnosisCode', pegaPropertyType: 'Text' },
  { pattern: /procedure.?code|cpt.?code|hcpcs/i, piiCategory: null, semantic: 'healthcare.procedureCode', pegaPropertyType: 'Text' },
  { pattern: /drug.?code|ndc.?code|medication.?code/i, piiCategory: null, semantic: 'healthcare.drugCode', pegaPropertyType: 'Text' },
  { pattern: /group.?num|group.?id|plan.?id/i, piiCategory: 'ACCOUNT', semantic: 'healthcare.groupNumber', pegaPropertyType: 'Text' },
  { pattern: /member.?id|subscriber.?id|member.?num/i, piiCategory: 'ACCOUNT', semantic: 'healthcare.memberId', pegaPropertyType: 'Text' },
  { pattern: /admit.?date|admission.?date|discharge.?date/i, piiCategory: null, semantic: 'healthcare.admissionDate', pegaPropertyType: 'Date' },
  { pattern: /service.?date|date.?of.?service|dos/i, piiCategory: null, semantic: 'healthcare.serviceDate', pegaPropertyType: 'Date' },

  // ============================================================================
  // EMPLOYMENT INFORMATION
  // ============================================================================
  { pattern: /employer|employer.?name|company.?name/i, piiCategory: 'NAME', semantic: 'employment.employerName', pegaPropertyType: 'Text' },
  { pattern: /job.?title|title|position|occupation/i, piiCategory: null, semantic: 'employment.jobTitle', pegaPropertyType: 'Text' },
  { pattern: /department|division|business.?unit/i, piiCategory: null, semantic: 'employment.department', pegaPropertyType: 'Text' },
  { pattern: /employee.?id|emp.?id|employee.?num/i, piiCategory: 'ACCOUNT', semantic: 'employment.employeeId', pegaPropertyType: 'Text' },
  { pattern: /hire.?date|start.?date|employment.?date/i, piiCategory: null, semantic: 'employment.hireDate', pegaPropertyType: 'Date' },
  { pattern: /termination.?date|end.?date|separation.?date/i, piiCategory: null, semantic: 'employment.terminationDate', pegaPropertyType: 'Date' },
  { pattern: /years.?employed|tenure|length.?of.?service/i, piiCategory: null, semantic: 'employment.tenure', pegaPropertyType: 'Integer' },
  { pattern: /supervisor|manager|reports.?to/i, piiCategory: 'NAME', semantic: 'employment.supervisor', pegaPropertyType: 'Text' },

  // ============================================================================
  // LEGAL/COMPLIANCE
  // ============================================================================
  { pattern: /case.?caption|matter.?name|legal.?case/i, piiCategory: null, semantic: 'legal.caseCaption', pegaPropertyType: 'Text' },
  { pattern: /docket.?num|court.?case.?num|filing.?num/i, piiCategory: 'ACCOUNT', semantic: 'legal.docketNumber', pegaPropertyType: 'Text' },
  { pattern: /bar.?num|attorney.?id|license.?num/i, piiCategory: 'ACCOUNT', semantic: 'legal.barNumber', pegaPropertyType: 'Text' },
  { pattern: /court|jurisdiction|venue/i, piiCategory: null, semantic: 'legal.court', pegaPropertyType: 'Text' },
  { pattern: /statute.?of.?limit|sol|limitation.?date/i, piiCategory: null, semantic: 'legal.statuteOfLimitations', pegaPropertyType: 'Date' },

  // ============================================================================
  // GOVERNMENT/PUBLIC SECTOR (Must come before CASE MANAGEMENT for specific patterns)
  // ============================================================================
  { pattern: /benefit.?type|program.?type|assistance.?type/i, piiCategory: null, semantic: 'government.benefitType', pegaPropertyType: 'Text' },
  { pattern: /eligibility|eligible|qualification/i, piiCategory: null, semantic: 'government.eligibility', pegaPropertyType: 'Boolean' },
  { pattern: /household.?size|family.?size|dependents/i, piiCategory: null, semantic: 'government.householdSize', pegaPropertyType: 'Integer' },
  { pattern: /citizenship|immigration.?status|residency/i, piiCategory: null, semantic: 'government.citizenship', pegaPropertyType: 'Text' },
  { pattern: /veteran.?status|military.?status|service.?status/i, piiCategory: null, semantic: 'government.veteranStatus', pegaPropertyType: 'Text' },

  // ============================================================================
  // CASE MANAGEMENT FIELDS (Non-PII) - Generic patterns, must come after specific
  // ============================================================================
  { pattern: /^status$|state|case.?status|workflow.?status/i, piiCategory: null, semantic: 'case.status', pegaPropertyType: 'Text' },
  { pattern: /priority|urgency|severity|impact/i, piiCategory: null, semantic: 'case.priority', pegaPropertyType: 'Text' },
  { pattern: /description|notes|comments|details|remarks/i, piiCategory: null, semantic: 'case.freeText', pegaPropertyType: 'Text' },
  { pattern: /reason|cause|justification|rationale/i, piiCategory: null, semantic: 'case.reason', pegaPropertyType: 'Text' },
  { pattern: /category|type|classification|subcategory/i, piiCategory: null, semantic: 'case.category', pegaPropertyType: 'Text' },
  { pattern: /resolution|outcome|result|decision/i, piiCategory: null, semantic: 'case.resolution', pegaPropertyType: 'Text' },
  { pattern: /owner|assigned.?to|assignee|current.?owner/i, piiCategory: null, semantic: 'case.owner', pegaPropertyType: 'Text' },
  { pattern: /created.?by|created.?by.?operator|originator/i, piiCategory: null, semantic: 'case.createdBy', pegaPropertyType: 'Text' },
  { pattern: /create.?date|created|submission.?date/i, piiCategory: null, semantic: 'case.createDate', pegaPropertyType: 'Date' },
  { pattern: /update.?date|modified|last.?updated|last.?modified/i, piiCategory: null, semantic: 'case.updateDate', pegaPropertyType: 'Date' },
  { pattern: /due.?date|deadline|target.?date|sla.?date/i, piiCategory: null, semantic: 'case.dueDate', pegaPropertyType: 'Date' },
  { pattern: /stage|stage.?name|current.?stage/i, piiCategory: null, semantic: 'case.stage', pegaPropertyType: 'Text' },
  { pattern: /process|process.?name|current.?process/i, piiCategory: null, semantic: 'case.process', pegaPropertyType: 'Text' },
  { pattern: /step|step.?name|current.?step/i, piiCategory: null, semantic: 'case.step', pegaPropertyType: 'Text' },

  // ============================================================================
  // INSURANCE SPECIFIC
  // ============================================================================
  { pattern: /loss.?date|date.?of.?loss|incident.?date/i, piiCategory: null, semantic: 'insurance.lossDate', pegaPropertyType: 'Date' },
  { pattern: /loss.?location|accident.?location|incident.?location/i, piiCategory: 'ADDRESS', semantic: 'insurance.lossLocation', pegaPropertyType: 'Text' },
  { pattern: /cause.?of.?loss|loss.?cause|peril/i, piiCategory: null, semantic: 'insurance.causeOfLoss', pegaPropertyType: 'Text' },
  { pattern: /adjuster|claims.?adjuster|examiner/i, piiCategory: null, semantic: 'insurance.adjuster', pegaPropertyType: 'Text' },
  { pattern: /reserve|loss.?reserve|indemnity.?reserve/i, piiCategory: null, semantic: 'insurance.reserve', pegaPropertyType: 'Currency' },
  { pattern: /coverage.?type|policy.?type|insurance.?type/i, piiCategory: null, semantic: 'insurance.coverageType', pegaPropertyType: 'Text' },

  // ============================================================================
  // SUPPLY CHAIN / LOGISTICS
  // ============================================================================
  { pattern: /sku|item.?num|product.?code|material.?num/i, piiCategory: null, semantic: 'logistics.sku', pegaPropertyType: 'Text' },
  { pattern: /quantity|qty|units|count/i, piiCategory: null, semantic: 'logistics.quantity', pegaPropertyType: 'Integer' },
  { pattern: /tracking.?num|shipment.?id|waybill/i, piiCategory: 'ACCOUNT', semantic: 'logistics.trackingNumber', pegaPropertyType: 'Text' },
  { pattern: /warehouse|location|facility|site/i, piiCategory: null, semantic: 'logistics.warehouse', pegaPropertyType: 'Text' },
  { pattern: /carrier|shipping.?carrier|freight.?carrier/i, piiCategory: null, semantic: 'logistics.carrier', pegaPropertyType: 'Text' },
  { pattern: /expected.?delivery|eta|arrival.?date/i, piiCategory: null, semantic: 'logistics.expectedDelivery', pegaPropertyType: 'Date' },
  { pattern: /ship.?date|delivery.?date|dispatch.?date/i, piiCategory: null, semantic: 'logistics.shipDate', pegaPropertyType: 'Date' },
];

// ============================================================================
// CASE DOMAIN PATTERNS
// ============================================================================

export const CASE_DOMAIN_PATTERNS: Record<string, RegExp[]> = {
  // ============================================================================
  // FINANCIAL SERVICES
  // ============================================================================
  'financial-lending': [
    /LoanRequest|LoanApplication|MortgageApp|MortgageApplication/i,
    /CreditApp|CreditApplication|CreditDecision|CreditApproval/i,
    /MortgageProcessing|MortgageOrigination|LoanOrigination/i,
    /AutoLoan|PersonalLoan|HomeEquity|HELOC/i,
    /LoanServicing|LoanModification|LoanRenewal/i,
    /Underwriting|RiskAssessment|CreditRisk/i,
  ],
  'insurance-claims': [
    /Claim|ClaimProcessing|InsuranceClaim|ClaimSubmission/i,
    /FNOL|FirstNoticeOfLoss|LossNotification/i,
    /ClaimAdjustment|ClaimApproval|ClaimSettlement/i,
    /ClaimInvestigation|FraudDetection|ClaimValidation/i,
    /AutoClaim|PropertyClaim|LiabilityClaim|WorkersComp/i,
    /PolicyRenewal|PolicyIssuance|QuoteGeneration/i,
    /Reinsurance|CatastropheClaim/i,
  ],
  'banking-operations': [
    /AccountOpening|AccountSetup|AccountOnboarding/i,
    /KYC|KnowYourCustomer|CustomerDueDiligence|CDD/i,
    /AccountMaintenance|AccountUpdate|AccountClosure/i,
    /WireTransfer|ACH|PaymentProcessing|FundTransfer/i,
    /Deposit|Withdrawal|TransactionProcessing/i,
    /Overdraft|FeeWaiver|DisputeResolution/i,
    /CardIssuance|CardActivation|CardReplacement/i,
    /StopPayment|CheckOrder|BankDraft/i,
  ],
  'wealth-management': [
    /InvestmentAccount|BrokerageAccount|TradingAccount/i,
    /PortfolioManagement|AssetAllocation|Rebalancing/i,
    /OrderExecution|TradeSettlement|OrderManagement/i,
    /FinancialPlanning|GoalPlanning|RetirementPlanning/i,
    /WealthTransfer|EstatePlanning|TrustManagement/i,
    /ComplianceReview|SuitabilityReview|RiskProfile/i,
  ],
  'collections-recovery': [
    /Collection|DebtCollection|PaymentCollection/i,
    /Delinquency|PastDue|OverdueAccount/i,
    /Recovery|AssetRecovery|ChargeOff/i,
    /PaymentPlan|Settlement|Restructuring/i,
    /SkipTracing|AssetSearch|Garnishment/i,
  ],

  // ============================================================================
  // HEALTHCARE & LIFE SCIENCES
  // ============================================================================
  'healthcare-patient': [
    /PatientCase|PatientRecord|PatientOnboarding/i,
    /ClinicalCase|MedicalRecord|PatientChart/i,
    /Treatment|TreatmentPlan|CarePlan/i,
    /Referral|SpecialistReferral|CareCoordination/i,
    /PreAuth|PriorAuthorization|AuthRequest/i,
    /Discharge|CareTransition|PostAcuteCare/i,
    /PatientCommunication|ProviderCommunication/i,
  ],
  'healthcare-claims': [
    /MedicalClaim|HealthClaim|ClaimAdjudication/i,
    /ClaimProcessing|ClaimPayment|EOB|ExplanationOfBenefits/i,
    /CoordinationOfBenefits|COB|SecondaryInsurance/i,
    /ClaimAppeal|ClaimDispute|Grievance/i,
    /ProviderClaim|ProfessionalClaim|InstitutionalClaim/i,
  ],
  'pharma-life-sciences': [
    /ClinicalTrial|TrialEnrollment|StudyManagement/i,
    /Pharmacovigilance|AdverseEvent|SafetyReport/i,
    /DrugApproval|RegulatorySubmission|NDA|BLA/i,
    /SampleRequest|ComplaintHandling|CAPA/i,
    /SupplyChain|DrugShortage|LotRelease/i,
  ],

  // ============================================================================
  // GOVERNMENT & PUBLIC SECTOR
  // ============================================================================
  'government-benefits': [
    /BenefitApplication|EligibilityDetermination/i,
    /Unemployment|UI|UnemploymentInsurance/i,
    /SNAP|FoodAssistance|Medicaid|Medicare/i,
    /HousingAssistance|Section8|PublicHousing/i,
    /DisabilityClaim|SSDI|SSI|DisabilityDetermination/i,
    /BenefitsRenewal|Recertification|Redetermination/i,
    /Overpayment|Recovery|FraudInvestigation/i,
  ],
  'government-permits': [
    /PermitApplication|BuildingPermit|ConstructionPermit/i,
    /LicenseApplication|BusinessLicense|ProfessionalLicense/i,
    /InspectionRequest|CodeCompliance|ZoningRequest/i,
    /EnvironmentalReview|ImpactAssessment|Clearance/i,
    /Variance|Appeal|HearingRequest/i,
  ],
  'tax-processing': [
    /TaxReturn|TaxFiling|TaxAssessment/i,
    /TaxRefund|RefundProcessing|Offset/i,
    /TaxAudit|Examination|ComplianceReview/i,
    /TaxCollection|PaymentPlan|OfferInCompromise/i,
    /IdentityVerification|FraudPrevention/i,
  ],

  // ============================================================================
  // COMMUNICATIONS & MEDIA
  // ============================================================================
  'telecom-order': [
    /OrderCapture|ProductOrder|ServiceOrder/i,
    /Provisioning|ServiceActivation|PortIn|PortOut/i,
    /InstallRequest|TechnicianDispatch|ServiceCall/i,
    /UpgradeRequest|DowngradeRequest|FeatureChange/i,
    /DeviceOrder|EquipmentRequest|SIMActivation/i,
    /ContractRenewal|ContractTermination|EarlyTermination/i,
  ],
  'telecom-service': [
    /TroubleTicket|OutageTicket|NetworkIncident/i,
    /RepairRequest|ServiceRestoration|NetworkIssue/i,
    /BillingInquiry|BillDispute|RatePlanChange/i,
    /TechnicalSupport|HelpDesk|CustomerCare/i,
    /Escalation|PriorityHandling|ExecutiveResponse/i,
  ],

  // ============================================================================
  // INSURANCE (EXPANDED)
  // ============================================================================
  'insurance-underwriting': [
    /NewBusiness|PolicyIssuance|QuoteToBind/i,
    /RiskAssessment|UnderwritingReview|RiskRating/i,
    /PolicyChange|Endorsement|Rider/i,
    /RenewalReview|NonRenewal|Cancellation/i,
    /ReinsurancePlacement|TreatyReview/i,
  ],
  'insurance-policy-admin': [
    /PolicyInquiry|PolicyLookup|CoverageVerification/i,
    /PolicyChange|AddressChange|NameChange/i,
    /CertificateRequest|EvidenceOfInsurance/i,
    /LossRun|ClaimsHistory|PolicyHistory/i,
    /Reinstatement|Reactivation|Lapse/i,
  ],

  // ============================================================================
  // SERVICE MANAGEMENT (ITSM/ESM)
  // ============================================================================
  'service-management': [
    /ServiceRequest|SvcReq|RequestFulfillment/i,
    /Incident|IncidentManagement|MajorIncident/i,
    /Problem|ProblemManagement|RootCause/i,
    /ChangeRequest|CR|ChangeManagement|CAB/i,
    /Release|Deployment|ReleaseManagement/i,
    /KnowledgeArticle|KBA|KnowledgeManagement/i,
    /ServiceCatalog|CatalogRequest/i,
  ],
  'it-operations': [
    /Alert|Monitoring|EventManagement/i,
    /MaintenanceWindow|ScheduledMaintenance/i,
    /CapacityRequest|ResourceProvisioning/i,
    /BackupRequest|RestoreRequest|DisasterRecovery/i,
    /SecurityIncident|VulnerabilityManagement|PatchManagement/i,
    /AccessRequest|IdentityManagement|Provisioning/i,
  ],

  // ============================================================================
  // HUMAN RESOURCES
  // ============================================================================
  'hr-onboarding': [
    /EmployeeOnboarding|NewHire|OnboardingTask/i,
    /BackgroundCheck|EmploymentVerification/i,
    /BenefitsEnrollment|OpenEnrollment|BenefitChange/i,
    /I9|WorkAuthorization|VisaSponsorship/i,
    /Orientation|TrainingAssignment|PolicyAcknowledgment/i,
  ],
  'hr-service': [
    /EmployeeRequest|HRRequest|EmployeeInquiry/i,
    /LeaveRequest|TimeOff|FMLA|LOA|LeaveOfAbsence/i,
    /PayrollInquiry|PayCorrection|Timesheet/i,
    /PerformanceReview|GoalSetting|DevelopmentPlan/i,
    /Separation|Offboarding|Termination|ExitInterview/i,
    /Transfer|Promotion|CompensationChange/i,
    /Grievance|HRComplaint|Investigation/i,
  ],
  'talent-acquisition': [
    /Requisition|JobRequisition|OpenPosition/i,
    /CandidateApplication|ApplicationReview|Screening/i,
    /InterviewScheduling|InterviewFeedback|OfferApproval/i,
    /BackgroundVerification|ReferenceCheck/i,
    /OfferLetter|HireDecision|CandidateExperience/i,
  ],

  // ============================================================================
  // SUPPLY CHAIN & LOGISTICS
  // ============================================================================
  'procurement': [
    /PurchaseRequest|PR|Requisition/i,
    /PurchaseOrder|PO|OrderPlacement/i,
    /SupplierOnboarding|VendorRegistration|VendorManagement/i,
    /RFQ|RFP|RFI|BidManagement/i,
    /ContractNegotiation|ContractRenewal/i,
    /InvoiceProcessing|InvoiceApproval|Payment/i,
    /GoodsReceipt|ReceiptConfirmation|QualityInspection/i,
  ],
  'logistics': [
    /Shipment|ShippingOrder|DeliveryRequest/i,
    /Tracking|Trace|LostShipment/i,
    /ReturnRequest|RMA|ReturnAuthorization/i,
    /WarehouseRequest|InventoryTransfer|StockMovement/i,
    /CustomsClearance|Import|Export|TradeCompliance/i,
    /LastMile|DeliveryException|Reschedule/i,
  ],

  // ============================================================================
  // CUSTOMER SERVICE
  // ============================================================================
  'customer-service': [
    /CustomerInquiry|GeneralInquiry|InformationRequest/i,
    /Complaint|CustomerComplaint|Grievance|Dispute/i,
    /Feedback|Survey|NPS|CustomerSatisfaction/i,
    /Escalation|SupervisorReview|ExecutiveComplaint/i,
    /ReturnRefund|Exchange|WarrantyClaim/i,
    /AccountInquiry|StatementRequest|BalanceInquiry/i,
  ],
  'contact-center': [
    /InboundCall|OutboundCall|CallbackRequest/i,
    /EmailResponse|ChatTranscript|SocialMediaResponse/i,
    /QueueManagement|Routing|SkillBasedAssignment/i,
    /AgentSchedule|TimeOffRequest|ShiftSwap/i,
  ],

  // ============================================================================
  // LEGAL & COMPLIANCE
  // ============================================================================
  'legal-matter': [
    /MatterManagement|LegalMatter|CaseManagement/i,
    /ContractReview|ContractApproval|LegalReview/i,
    /Litigation|LegalHold|DiscoveryRequest/i,
    /IPApplication|Trademark|Patent|Copyright/i,
    /ComplianceReview|RegulatoryFiling|Audit/i,
    /LegalResearch|OpinionRequest|CounselRequest/i,
  ],
  'regulatory-compliance': [
    /ComplianceFiling|RegulatoryReport|Disclosure/i,
    /AuditRequest|Examination|SupervisoryReview/i,
    /SanctionsScreening|AML|KYC|OFAC/i,
    /PrivacyRequest|GDPR|DataSubjectRequest|DSAR/i,
    /Whistleblower|EthicsReport|ComplianceInvestigation/i,
  ],

  // ============================================================================
  // MANUFACTURING
  // ============================================================================
  'manufacturing': [
    /ProductionOrder|WorkOrder|ManufacturingOrder/i,
    /QualityInspection|QC|NonConformance|NCR/i,
    /EquipmentRequest|MaintenanceRequest|PM/i,
    /ChangeRequest|ECR|ECO|EngineeringChange/i,
    /SafetyIncident|NearMiss|HazardReport/i,
    /InventoryAdjustment|CycleCount|StockCorrection/i,
    /SupplierQuality|SCAR|CorrectiveAction/i,
  ],

  // ============================================================================
  // UTILITIES & ENERGY
  // ============================================================================
  'utilities': [
    /ServiceConnection|NewService|StartService/i,
    /ServiceDisconnection|StopService|MoveOut/i,
    /MeterReading|MeterInstall|MeterExchange/i,
    /OutageReport|Restoration|EmergencyResponse/i,
    /BillingInquiry|PaymentArrangement|BudgetBilling/i,
    /EnergyAudit|RebateProgram|EfficiencyProgram/i,
  ],
  'energy-trading': [
    /TradeCapture|DealTicket|Transaction/i,
    /Settlement|Invoice|Billing/i,
    /Scheduling|Nominations|Capacity/i,
    /PositionManagement|RiskManagement/i,
  ],
};

// ============================================================================
// ACTION BUTTON PATTERNS - Comprehensive
// ============================================================================

export interface ActionPattern {
  patterns: RegExp[];
  actionType: ActionType;
  requiresConfirmation: boolean;
  isFlowAction?: boolean;
  isLocalAction?: boolean;
  isBulkAction?: boolean;
}

export const ACTION_BUTTON_PATTERNS: ActionPattern[] = [
  // ============================================================================
  // PRIMARY CASE ACTIONS
  // ============================================================================
  {
    patterns: [/submit|complete|finish|finalize|confirm/i],
    actionType: 'submit',
    requiresConfirmation: true,
    isFlowAction: true,
  },
  {
    patterns: [/approve|accept|authorize|sanction/i],
    actionType: 'submit',
    requiresConfirmation: true,
    isFlowAction: true,
  },
  {
    patterns: [/close.?case|resolve|complete.?case|conclude/i],
    actionType: 'submit',
    requiresConfirmation: true,
    isFlowAction: true,
  },
  {
    patterns: [/^save$|save.?changes|save.?and.?continue|apply.?changes/i],
    actionType: 'save',
    requiresConfirmation: false,
  },
  {
    patterns: [/save.?draft|save.?for.?later|save.?progress/i],
    actionType: 'save',
    requiresConfirmation: false,
  },
  {
    patterns: [/^next$|continue|proceed|go.?to.?next|next.?step/i],
    actionType: 'next',
    requiresConfirmation: false,
    isFlowAction: true,
  },
  {
    patterns: [/previous|back|go.?back|return|prev.?step/i],
    actionType: 'cancel',
    requiresConfirmation: false,
    isFlowAction: true,
  },
  {
    patterns: [/cancel|discard|abort|withdraw/i],
    actionType: 'cancel',
    requiresConfirmation: true,
    isFlowAction: true,
  },
  {
    patterns: [/reject|deny|decline|refuse/i],
    actionType: 'cancel',
    requiresConfirmation: true,
    isFlowAction: true,
  },

  // ============================================================================
  // ROUTING & ASSIGNMENT ACTIONS
  // ============================================================================
  {
    patterns: [/escalat|escalate.?to|send.?to.?supervisor/i],
    actionType: 'escalate',
    requiresConfirmation: true,
    isFlowAction: true,
  },
  {
    patterns: [/transfer|route.?to|send.?to|hand.?off/i],
    actionType: 'escalate',
    requiresConfirmation: true,
    isFlowAction: true,
  },
  {
    patterns: [/assign|reassign|delegate|forward/i],
    actionType: 'assign',
    requiresConfirmation: true,
  },
  {
    patterns: [/claim|take.?ownership|pull|grab.?case/i],
    actionType: 'assign',
    requiresConfirmation: false,
  },
  {
    patterns: [/release|return.?to.?queue|put.?back|unclaim/i],
    actionType: 'assign',
    requiresConfirmation: false,
  },
  {
    patterns: [/bulk.?assign|mass.?assign|multi.?assign/i],
    actionType: 'assign',
    requiresConfirmation: true,
    isBulkAction: true,
  },

  // ============================================================================
  // WORKFLOW ACTIONS
  // ============================================================================
  {
    patterns: [/reopen|reopen.?case|resume|continue.?work/i],
    actionType: 'generic',
    requiresConfirmation: false,
    isFlowAction: true,
  },
  {
    patterns: [/hold|suspend|pause|stop.?work/i],
    actionType: 'generic',
    requiresConfirmation: true,
  },
  {
    patterns: [/pend|pending|wait.?for|hold.?for/i],
    actionType: 'generic',
    requiresConfirmation: false,
  },
  {
    patterns: [/review|send.?for.?review|peer.?review/i],
    actionType: 'escalate',
    requiresConfirmation: false,
    isFlowAction: true,
  },
  {
    patterns: [/approve.?and.?forward|approve.?and.?route/i],
    actionType: 'submit',
    requiresConfirmation: true,
    isFlowAction: true,
  },

  // ============================================================================
  // LOCAL ACTIONS (Stay on same step)
  // ============================================================================
  {
    patterns: [/add.?note|add.?comment|attach.?note|update.?notes/i],
    actionType: 'generic',
    requiresConfirmation: false,
    isLocalAction: true,
  },
  {
    patterns: [/attach|add.?attachment|upload|attach.?file/i],
    actionType: 'generic',
    requiresConfirmation: false,
    isLocalAction: true,
  },
  {
    patterns: [/add.?party|add.?participant|add.?contact/i],
    actionType: 'generic',
    requiresConfirmation: false,
    isLocalAction: true,
  },
  {
    patterns: [/print|export|download|pdf/i],
    actionType: 'generic',
    requiresConfirmation: false,
    isLocalAction: true,
  },
  {
    patterns: [/email|send.?email|notify|correspondence/i],
    actionType: 'generic',
    requiresConfirmation: false,
    isLocalAction: true,
  },
  {
    patterns: [/history|view.?history|audit.?trail|timeline/i],
    actionType: 'generic',
    requiresConfirmation: false,
    isLocalAction: true,
  },

  // ============================================================================
  // BULK ACTIONS
  // ============================================================================
  {
    patterns: [/bulk.?update|mass.?update|batch.?update/i],
    actionType: 'generic',
    requiresConfirmation: true,
    isBulkAction: true,
  },
  {
    patterns: [/bulk.?close|mass.?resolve|batch.?complete/i],
    actionType: 'submit',
    requiresConfirmation: true,
    isBulkAction: true,
  },
  {
    patterns: [/bulk.?transfer|mass.?transfer|batch.?route/i],
    actionType: 'escalate',
    requiresConfirmation: true,
    isBulkAction: true,
  },

  // ============================================================================
  // DELETE/REMOVE ACTIONS
  // ============================================================================
  {
    patterns: [/delete|remove|purge|destroy/i],
    actionType: 'cancel',
    requiresConfirmation: true,
  },
  {
    patterns: [/withdraw|recall|cancel.?request/i],
    actionType: 'cancel',
    requiresConfirmation: true,
    isFlowAction: true,
  },
];

// ============================================================================
// PEGA DETECTION SELECTORS - Comprehensive
// ============================================================================

export const PEGA_CONSTELLATION_SELECTORS = [
  // Root containers
  '#pega-ui-root',
  '[data-pega-app]',
  '.pega-constellation-root',
  '[data-constellation]',
  'div[class*="constellation"]',
  // Constellation specific elements
  '[data-test-id*="constellation"]',
  '.pds-root',
  '[class*="PegaDxil"]',
];

export const PEGA_CLASSIC_SELECTORS = [
  // Classic harness elements
  '.pega-ui-form',
  '.harness-body',
  '#pegaui',
  '.rule-ui-body',
  '.screen-layout',
  // Section templates
  '.section-div',
  '.layout-content',
  '[class*="section"]',
  // Dynamic layouts
  '.dynamic-layout',
  '.flex-column',
  '.flex-row',
  // Grid layouts
  '.grid-layout',
  '.repeat-grid',
  '.repeat-grid-body',
  // Form elements
  '.field-content',
  '.control-item',
  '.input-area',
  // Action area
  '.action-bar',
  '.actions-container',
  '.button-bar',
];

export const PEGA_COSMOS_SELECTORS = [
  '[data-ui-engine="cosmos"]',
  '.cosmos-root',
  '[class*="cosmos"]',
  '.cosmos-shell',
  '.cosmos-case',
  '.cosmos-workarea',
];

// ============================================================================
// PEGA UI COMPONENT SELECTORS
// ============================================================================

export const PEGA_COMPONENT_SELECTORS = {
  // Form Controls
  textInput: ['input[type="text"]', '.text-input', '[data-test-id*="TextInput"]', '.textInput'],
  textArea: ['textarea', '.text-area', '[data-test-id*="TextArea"]'],
  dropdown: ['select', '.dropdown', '[data-test-id*="Dropdown"]', '.simple-select'],
  checkbox: ['input[type="checkbox"]', '.checkbox', '[data-test-id*="Checkbox"]', '.checkbox-control'],
  radio: ['input[type="radio"]', '.radio-group', '[data-test-id*="Radio"]'],
  datePicker: ['input[type="date"]', '.date-picker', '[data-test-id*="Date"]', '.dateInput'],
  autoComplete: ['.autocomplete', '[data-test-id*="AutoComplete"]', '.ac-input'],
  currencyInput: ['.currency-input', '[data-test-id*="Currency"]', '.money-input'],
  phoneNumber: ['.phone-input', '[data-test-id*="Phone"]', '.telephone-input'],
  emailInput: ['input[type="email"]', '.email-input', '[data-test-id*="Email"]'],

  // Buttons
  primaryButton: ['.primary-btn', '[data-test-id*="Primary"]', '.pzhc', 'button.primary'],
  secondaryButton: ['.secondary-btn', '[data-test-id*="Secondary"]', 'button.secondary'],
  menuButton: ['.menu-button', '[data-test-id*="Menu"]', '.dropdown-toggle'],
  actionButton: ['.action-button', '[data-test-id*="Action"]', '.actionButton'],

  // Navigation
  breadcrumb: ['.breadcrumb', '[data-test-id*="Breadcrumb"]', '.breadcrumbs'],
  tab: ['.tab', '[data-test-id*="Tab"]', '.tab-item'],
  menu: ['.menu', '[data-test-id*="Menu"]', '.nav-menu'],
  sidebar: ['.sidebar', '[data-test-id*="Sidebar"]', '.navigation-panel'],

  // Data Display
  grid: ['.grid', '[data-test-id*="Grid"]', '.repeat-grid', '.table-layout'],
  treeGrid: ['.tree-grid', '[data-test-id*="Tree"]'],
  listView: ['.list-view', '[data-test-id*="List"]', '.simple-list'],
  card: ['.card', '[data-test-id*="Card"]', '.summary-card'],
  table: ['table', '.data-table', '.styled-table'],

  // Case Elements
  caseHeader: ['.case-header', '[data-test-id*="CaseHeader"]', '.case-summary'],
  caseInfo: ['.case-info', '[data-test-id*="CaseInfo"]', '.pyCaseInfo'],
  stageIndicator: ['.stage-indicator', '[data-test-id*="Stage"]', '.process-stages'],
  assignmentInfo: ['.assignment-info', '[data-test-id*="Assignment"]', '.assignment-header'],

  // Attachments
  attachment: ['.attachment', '[data-test-id*="Attachment"]', '.attachment-item'],
  attachmentList: ['.attachment-list', '[data-test-id*="AttachmentList"]'],

  // Status/Feedback
  statusBadge: ['.status-badge', '[data-test-id*="Status"]', '.status-indicator'],
  error: ['.error', '.validation-error', '.error-message', '[data-test-id*="Error"]'],
  warning: ['.warning', '.warning-message', '.alert-warning'],
  info: ['.info', '.info-message', '.alert-info'],
  success: ['.success', '.success-message', '.alert-success'],

  // Loading/Progress
  loading: ['.loading', '.spinner', '.progress-indicator', '[data-test-id*="Loading"]'],
  progressBar: ['.progress-bar', '.progress', '[data-test-id*="Progress"]'],

  // Modal/Dialog
  modal: ['.modal', '.dialog', '.overlay', '[data-test-id*="Modal"]'],
  modalContent: ['.modal-content', '.dialog-content', '.modal-body'],
  modalHeader: ['.modal-header', '.dialog-header'],
  modalFooter: ['.modal-footer', '.dialog-footer'],
};

// ============================================================================
// PEGA DATA-TEST-ID PATTERNS
// ============================================================================

export const PEGA_TEST_ID_PATTERNS = {
  field: /^Field_[A-Za-z]+$/i,
  button: /^Button_[A-Za-z]+$/i,
  action: /^Action_[A-Za-z]+$/i,
  section: /^Section_[A-Za-z]+$/i,
  grid: /^Grid_[A-Za-z]+$/i,
  tab: /^Tab_[A-Za-z]+$/i,
  link: /^Link_[A-Za-z]+$/i,
  label: /^Label_[A-Za-z]+$/i,
  row: /^Row_\d+$/i,
  column: /^Column_\d+$/i,
  assignment: /^Assignment_[A-Za-z0-9]+$/i,
  case: /^Case_[A-Za-z0-9-]+$/i,
  stage: /^Stage_\d+_[A-Za-z]+$/i,
  process: /^Process_[A-Za-z]+$/i,
};

// ============================================================================
// CASE LIFECYCLE PATTERNS
// ============================================================================

export const CASE_LIFECYCLE_PATTERNS = {
  // Standard stages across domains
  commonStages: {
    intake: [/intake|submission|application|request/i],
    review: [/review|assessment|evaluation|analysis/i],
    approval: [/approval|decision|authorization|sign.?off/i],
    fulfillment: [/fulfillment|execution|processing|implementation/i],
    completion: [/completion|resolution|closure|finalization/i],
  },

  // Stage status indicators
  stageStatus: {
    notStarted: [/not.?started|pending|queued|waiting/i],
    inProgress: [/in.?progress|active|current|running/i],
    completed: [/completed|done|finished|resolved/i],
    error: [/error|failed|exception|blocked/i],
    skipped: [/skipped|bypassed|optional/i],
  },

  // Process patterns within stages
  processTypes: {
    assignment: [/assignment|task|work.?item/i],
    decision: [/decision|gateway|branch|condition/i],
    subProcess: [/sub.?process|sub.?case|spawn|child.?case/i],
    notification: [/notification|alert|reminder|email/i],
    integration: [/integration|service|connector|api/i],
    wait: [/wait|delay|timer|hold/i],
  },

  // Step patterns
  stepTypes: {
    form: [/form|data.?entry|input|capture/i],
    review: [/review|verify|validate|check/i],
    approval: [/approve|reject|authorize|sign/i],
    action: [/action|execute|perform|complete/i],
    information: [/information|display|view|read.?only/i],
  },
};

// ============================================================================
// WORK OBJECT & CLASS HIERARCHY PATTERNS
// ============================================================================

export const WORK_OBJECT_PATTERNS = {
  // Class hierarchy pattern: Org-Div-Unit-Work-Class
  classHierarchy: /^[A-Z][a-zA-Z0-9]*-[A-Z][a-zA-Z0-9]*-[A-Z][a-zA-Z0-9]*-Work(-[A-Z][a-zA-Z0-9]*)*$/,

  // Work object ID patterns
  workObjectId: {
    standard: /^[A-Z]{2,6}-[A-Z0-9]+$/i,        // e.g., C-123, LOAN-456
    withClass: /^[A-Z]+-W[0-9]+$/i,             // e.g., SAMP-W1234
    insKey: /^SAMPLE-WORK\s+[A-Z0-9-]+$/i,      // Internal pzInsKey format
  },

  // Prefix patterns for common case types
  casePrefixes: {
    loan: /^L[OA][-_]?/i,
    claim: /^CL[-_]?/i,
    serviceRequest: /^SR[-_]?/i,
    incident: /^INC[-_]?/i,
    changeRequest: /^CR[-_]?/i,
    problem: /^PRB[-_]?/i,
    case: /^C[-_]?/i,
    work: /^W[-_]?/i,
  },

  // Class pattern mappings
  classPatterns: {
    framework: /-FW-|-Int-/i,
    implementation: /-Impl-|-Work-/i,
    data: /-Data-/i,
    integration: /-Int-|-Connect-|-Service-/i,
    rule: /-Rule-/i,
  },
};

// ============================================================================
// ASSIGNMENT & ROUTING PATTERNS
// ============================================================================

export const ASSIGNMENT_PATTERNS = {
  // Assignment types
  assignmentTypes: {
    user: /user|operator|individual|person/i,
    workbasket: /workbasket|queue|team|group|pool/i,
    worklist: /worklist|my.?work|personal/i,
    routed: /routed|assigned|directed/i,
  },

  // Routing patterns
  routingMethods: {
    skill: /skill|competency|expertise/i,
    availability: /availability|capacity|workload|least.?busy/i,
    loadBalanced: /load.?balanc|distribute|even/i,
    roundRobin: /round.?robin|sequential|rotate/i,
    custom: /custom|business.?rule|decision/i,
    reporting: /reporting|manager|supervisor|escalation/i,
  },

  // Queue types
  queueTypes: {
    team: /team|group|unit|department/i,
    skill: /skill|specialty|expertise/i,
    priority: /priority|urgent|expedite|vip/i,
    geographic: /region|territory|zone|location/i,
  },

  // Assignment status
  assignmentStatus: {
    new: /new|unassigned|available|open/i,
    assigned: /assigned|in.?progress|active|working/i,
    completed: /completed|resolved|closed|finished/i,
    pending: /pending|waiting|on.?hold|suspended/i,
  },

  // Workbasket selectors
  workbasketSelectors: [
    '[data-test-id*="Workbasket"]',
    '.workbasket-queue',
    '.team-queue',
    '.assignment-queue',
    '[class*="workbasket"]',
  ],
};

// ============================================================================
// SLA & DEADLINE PATTERNS
// ============================================================================

export const SLA_PATTERNS = {
  // SLA time units
  timeUnits: {
    minutes: /min(ute)?s?/i,
    hours: /hr|hour(s)?/i,
    days: /day(s)?|d$/i,
    business: /business.?day|work.?day/i,
    calendar: /calendar.?day/i,
  },

  // SLA intervals
  intervals: {
    goal: /goal|target|expected/i,
    deadline: /deadline|due|final|critical/i,
    passedDeadline: /passed.?deadline|late|overdue|escalat/i,
  },

  // SLA actions
  slaActions: {
    escalate: /escalat|notify|alert/i,
    reassign: /reassign|transfer|route/i,
    urgency: /urgency|priority|boost/i,
    email: /email|notify|correspondence/i,
  },

  // Urgency patterns
  urgencyLevels: {
    low: /^([1-3]\d|10)$/i,
    medium: /^([4-6]\d)$/i,
    high: /^([7-8]\d)$/i,
    critical: /^(9\d|100)$/i,
  },

  // Deadline calculation
  deadlinePatterns: {
    fromCreation: /from.?creation|start.?time|open/i,
    fromAssignment: /from.?assignment|routed|assigned/i,
    fromEvent: /from.?event|trigger|action/i,
  },

  // SLA status indicators
  slaStatus: {
    onTrack: /on.?track|green|within|goal/i,
    approaching: /approaching|warning|yellow|near/i,
    overdue: /overdue|late|red|breached|exceeded/i,
  },
};

// ============================================================================
// CORRESPONDENCE & NOTIFICATION PATTERNS
// ============================================================================

export const CORRESPONDENCE_PATTERNS = {
  // Correspondence types
  types: {
    email: /email|e-mail|mail/i,
    letter: /letter|mail|postal|print/i,
    sms: /sms|text|mobile.?message/i,
    notification: /notification|alert|push/i,
    fax: /fax|facsimile/i,
  },

  // Email patterns
  emailComponents: {
    to: /to|recipient|send.?to/i,
    cc: /cc|carbon.?copy/i,
    bcc: /bcc|blind.?copy/i,
    subject: /subject|title|topic/i,
    body: /body|content|message|text/i,
    attachment: /attachment|file|document/i,
  },

  // Correspondence status
  status: {
    draft: /draft|unsent|pending|queued/i,
    sent: /sent|delivered|transmitted/i,
    failed: /failed|bounced|error|undeliverable/i,
    opened: /opened|read|viewed/i,
  },

  // Template patterns
  templates: {
    notification: /notification|alert|update/i,
    confirmation: /confirmation|receipt|acknowledgment/i,
    reminder: /reminder|follow.?up|notice/i,
    escalation: /escalation|urgent|priority/i,
    resolution: /resolution|closure|complete/i,
  },

  // Corr selectors
  correspondenceSelectors: [
    '[data-test-id*="Correspondence"]',
    '.correspondence-history',
    '.email-thread',
    '.notification-list',
    '[class*="corr"]',
  ],
};

// ============================================================================
// DATA PAGE PATTERNS
// ============================================================================

export const DATA_PAGE_PATTERNS = {
  // Data page naming conventions
  namingConventions: {
    lookup: /^D_/i,                              // D_CustomerList
    list: /^D_[A-Z][a-zA-Z]*List$/i,            // D_ProductList
    page: /^D_[A-Z][a-zA-Z]*Page$/i,            // D_AccountPage
    singular: /^D_[A-Z][a-zA-Z]*(?!List|Page)$/i,
  },

  // Data page types
  pageTypes: {
    read: /read|lookup|retrieve/i,
    readWrite: /read.?write|editable|savable/i,
    editable: /editable|savable|updateable/i,
  },

  // Scope
  scope: {
    thread: /thread|request|current/i,
    requestor: /requestor|session|user/i,
    node: /node|server|global/i,
  },

  // Refresh strategies
  refreshStrategies: {
    timed: /timed|interval|periodic/i,
    eachInteraction: /each.?interaction|always|force/i,
    whenUsed: /when.?used|on.?demand|lazy/i,
    never: /never|static|cached/i,
  },

  // Common data page patterns
  commonDataPages: [
    /D_Operator/i,
    /D_Organization/i,
    /D_Unit/i,
    /D_Channel/i,
    /D_Calendar/i,
    /D_User/i,
    /D_Customer/i,
    /D_Account/i,
    /D_Product/i,
    /D_Country/i,
    /D_State/i,
    /D_Currency/i,
  ],
};

// ============================================================================
// FLOW & CONNECTOR PATTERNS
// ============================================================================

export const FLOW_PATTERNS = {
  // Flow types
  flowTypes: {
    screenFlow: /screen|straight.?through|stt/i,
    processFlow: /process|workflow|case/i,
    subFlow: /sub.?flow|sub.?process|called/i,
    spinOff: /spin.?off|parallel|async/i,
    splitJoin: /split.?join|parallel|fork/i,
  },

  // Connector types
  connectorTypes: {
    flowAction: /flow.?action|button|action/i,
    when: /when|condition|rule|branch/i,
    status: /status|state|outcome/i,
    always: /always|default|fallback/i,
    exception: /exception|error|fault/i,
  },

  // Flow action patterns
  flowActionTypes: {
    assignment: /assignment|task|work/i,
    utility: /utility|activity|automation/i,
    notification: /notification|email|alert/i,
    integration: /integration|connector|service/i,
    routing: /routing|assign|transfer/i,
    decision: /decision|rule|evaluate/i,
  },

  // Flow shapes (for flow diagram interpretation)
  shapes: {
    start: /start|begin|initiate/i,
    end: /end|finish|stop|terminate/i,
    assignment: /assignment|task|human/i,
    decision: /decision|gateway|diamond|branch/i,
    process: /process|sub.?process|rectangle/i,
    connector: /connector|arrow|transition/i,
    wait: /wait|timer|delay/i,
  },

  // Flow status
  flowStatus: {
    running: /running|active|in.?progress/i,
    completed: /completed|finished|resolved/i,
    suspended: /suspended|paused|held/i,
    error: /error|failed|exception/i,
  },
};

// ============================================================================
// DECISION RULE PATTERNS
// ============================================================================

export const DECISION_PATTERNS = {
  // Decision rule types
  ruleTypes: {
    decisionTable: /decision.?table|lookup.?table|matrix/i,
    decisionTree: /decision.?tree|tree|branch/i,
    mapValue: /map.?value|map|key.?value/i,
    when: /when|condition|rule/i,
    declareExpression: /declare.?expression|calculated|derived/i,
    decisionStrategy: /decision.?strategy|next.?best|nb/i,
  },

  // Decision outcomes
  outcomes: {
    boolean: /true|false|yes|no|1|0/i,
    value: /value|result|output|return/i,
    action: /action|route|path|branch/i,
    score: /score|rating|rank|grade/i,
  },

  // Common decision patterns
  patterns: {
    routing: /route|assign|transfer|escalate/i,
    approval: /approve|reject|review|authorize/i,
    eligibility: /eligible|qualify|entitled|eligible/i,
    scoring: /score|rate|grade|assess/i,
    recommendation: /recommend|suggest|next.?best|offer/i,
  },
};

// ============================================================================
// INTEGRATION PATTERNS
// ============================================================================

export const INTEGRATION_PATTERNS = {
  // Connector types
  connectorTypes: {
    rest: /rest|api|http|web.?service/i,
    soap: /soap|wsdl|xml/i,
    database: /database|db|sql|jdbc/i,
    mq: /mq|jms|queue|message/i,
    file: /file|ftp|sftp|csv/i,
    email: /email|smtp|imap|pop/i,
  },

  // Integration patterns
  patterns: {
    requestResponse: /request.?response|sync|synchronous/i,
    fireForget: /fire.?forget|async|asynchronous|one.?way/i,
    polling: /poll|batch|scheduled|interval/i,
    event: /event|webhook|push|trigger/i,
  },

  // Authentication methods
  authentication: {
    basic: /basic|username|password/i,
    oauth: /oauth|token|bearer|jwt/i,
    apiKey: /api.?key|key|secret/i,
    certificate: /certificate|ssl|tls|mutual/i,
  },

  // Integration status
  status: {
    success: /success|completed|ok|200/i,
    failure: /failure|error|failed|exception/i,
    timeout: /timeout|timed.?out|exceeded/i,
    retry: /retry|retrying|attempt/i,
  },

  // Common integration endpoints
  commonEndpoints: [
    /\/api\/v[0-9]+\//i,
    /\/prweb\/PRRestService\//i,
    /\/prweb\/services\//i,
    /\/csp\//i,
  ],
};

// ============================================================================
// PORTAL & DASHBOARD PATTERNS
// ============================================================================

export const PORTAL_PATTERNS = {
  // Portal types
  portalTypes: {
    caseManager: /case.?manager|manager|supervisor/i,
    user: /user|worker|caseworker|agent/i,
    manager: /manager|supervisor|team.?lead/i,
    admin: /admin|administrator|system/i,
    customer: /customer|self.?service|portal/i,
    developer: /developer|studio|designer/i,
  },

  // Dashboard components
  dashboardComponents: {
    chart: /chart|graph|plot|visual/i,
    kpi: /kpi|metric|gauge|score/i,
    report: /report|summary|statistics/i,
    widget: /widget|tile|card|panel/i,
    filter: /filter|criteria|search|parameter/i,
  },

  // Portal selectors
  portalSelectors: {
    caseManager: ['.case-manager', '[data-portal*="Manager"]', '.manager-portal'],
    user: ['.user-portal', '[data-portal*="User"]', '.worker-portal'],
    dashboard: ['.dashboard', '[data-test-id*="Dashboard"]', '.summary-dashboard'],
    worklist: ['.worklist', '[data-test-id*="Worklist"]', '.my-work'],
  },

  // Navigation patterns
  navigation: {
    menu: /menu|nav|navigation|sidebar/i,
    tab: /tab|section|panel/i,
    breadcrumb: /breadcrumb|trail|path/i,
    search: /search|find|lookup/i,
  },
};

// ============================================================================
// ERROR & VALIDATION PATTERNS
// ============================================================================

export const ERROR_PATTERNS = {
  // Validation error types
  validationTypes: {
    required: /required|mandatory|must|please.?enter/i,
    format: /format|invalid|incorrect|malformed/i,
    range: /range|between|minimum|maximum|exceed/i,
    pattern: /pattern|match|regex|does.?not.?match/i,
    custom: /custom|business|rule|validation/i,
  },

  // Error severity
  severity: {
    error: /error|critical|fatal|blocked/i,
    warning: /warning|caution|attention|alert/i,
    info: /info|information|note|notice/i,
  },

  // Common error messages
  commonErrors: {
    required: /this.?field.?is.?required|please.?enter|mandatory/i,
    invalid: /invalid|not.?valid|incorrect/i,
    notFound: /not.?found|does.?not.?exist|missing/i,
    permission: /permission|denied|unauthorized|access.?denied/i,
    timeout: /timeout|timed.?out|connection/i,
    system: /system|unexpected|exception|error/i,
  },

  // Error selectors
  errorSelectors: [
    '.validation-error',
    '.error-message',
    '.field-error',
    '[data-test-id*="Error"]',
    '.has-error',
    '.invalid-feedback',
    '.error-text',
    '.pyErrorMessage',
  ],

  // Validation states
  validationStates: {
    valid: /valid|success|passed|ok/i,
    invalid: /invalid|error|failed|error/i,
    pending: /pending|validating|checking/i,
  },
};

// ============================================================================
// PEGA API PATTERNS
// ============================================================================

export const PEGA_API_PATTERNS = {
  // REST API endpoints
  endpoints: {
    // Case API
    createCase: /\/cases$/i,
    getCase: /\/cases\/[A-Z0-9-]+$/i,
    updateCase: /\/cases\/[A-Z0-9-]+$/i,
    caseActions: /\/cases\/[A-Z0-9-]+\/actions$/i,
    performAction: /\/cases\/[A-Z0-9-]+\/actions\/[A-Za-z]+$/i,

    // Assignment API
    getAssignment: /\/assignments\/[A-Z0-9-]+$/i,
    assignmentActions: /\/assignments\/[A-Z0-9-]+\/actions$/i,
    performAssignment: /\/assignments\/[A-Z0-9-]+\/actions\/[A-Za-z]+$/i,

    // Data API
    dataPage: /\/data\/[A-Z][a-zA-Z0-9_]+$/i,
    dataView: /\/data\/views\/[A-Z][a-zA-Z0-9_]+$/i,

    // Document API
    document: /\/documents\/[A-Z0-9-]+$/i,
    attachments: /\/cases\/[A-Z0-9-]+\/attachments$/i,

    // User API
    currentUser: /\/users\/current$/i,
    userDetails: /\/users\/[A-Za-z0-9]+$/i,
  },

  // API methods
  methods: {
    GET: /^GET$/i,
    POST: /^POST$/i,
    PUT: /^PUT$/i,
    PATCH: /^PATCH$/i,
    DELETE: /^DELETE$/i,
  },

  // API response codes
  responseCodes: {
    success: /^2\d\d$/,
    redirect: /^3\d\d$/,
    clientError: /^4\d\d$/,
    serverError: /^5\d\d$/,
  },

  // Common API headers
  headers: {
    authorization: /^Authorization$/i,
    contentType: /^Content-Type$/i,
    accept: /^Accept$/i,
    etag: /^ETag$/i,
    ifMatch: /^If-Match$/i,
  },

  // API base URLs
  baseUrls: {
    pegaCloud: /\/prweb\/api\/v[0-9]+\//i,
    infinity: /\/api\/v[0-9]+\//i,
    classic: /\/PRRestService\//i,
  },
};

// ============================================================================
// URL PATTERNS - Comprehensive
// ============================================================================

export const URL_PATTERNS = {
  // Case/Work object patterns
  caseId: {
    standard: /\/case\/([A-Z0-9-]+)/i,
    plural: /\/cases\/([A-Z0-9-]+)/i,
    workObject: /\/work\/([A-Z]+-[A-Z0-9]+)/i,
    insKey: /pyWorkPage\.pzInsKey/i,
    // Match patterns like /death-claims/DEATHCLAIM-3231
    pathCaseId: /\/([a-z-]+)\/([A-Z][A-Z0-9]+-\d+)$/i,
  },

  // Pega URL patterns
  pegaUrls: {
    designerStudio: /\/DesignerStudio/i,
    caseManager: /\/CaseManager/i,
    userPortal: /\/UserPortal/i,
    managerPortal: /\/ManagerPortal/i,
    devStudio: /\/DevStudio/i,
    adminStudio: /\/AdminStudio/i,
  },

  // Common URL segments
  urlSegments: {
    prweb: /\/prweb\//i,
    pegaCloud: /\.pegacloud\.io/i,
    pegaCom: /\.pega\.com/i,
    sapi: /\/sapi\//i,
    csp: /\/csp\//i,
  },

  // Action URLs
  actionUrls: {
    flowAction: /\/flowaction\//i,
    harness: /\/harness\//i,
    activity: /\/activity\//i,
    dataPage: /\/datapage\//i,
    openAssignment: /\/assignment\//i,
    openWorkItem: /\/workitem\//i,
  },

  // Query parameters
  queryParams: {
    workPool: /workPool=([A-Za-z0-9-]+)/i,
    workClass: /workClass=([A-Za-z0-9-]+)/i,
    action: /action=([A-Za-z0-9_]+)/i,
    harness: /harness=([A-Za-z0-9_]+)/i,
    tab: /tab=([A-Za-z0-9_]+)/i,
  },
};

// Legacy exports for backward compatibility
export const CASE_ID_URL_PATTERN = URL_PATTERNS.caseId.standard;
export const CASE_ID_ALT_PATTERN = URL_PATTERNS.caseId.plural;
export const WORK_OBJECT_PATTERN = /([A-Z]{2,12})-([A-Z0-9]+)/i;

// ============================================================================
// PEGA TERMINOLOGY & CONCEPTS
// ============================================================================

export const PEGA_TERMINOLOGY = {
  // Core concepts
  concepts: {
    caseType: 'A reusable template that defines the data, processes, and stages for a type of work',
    case: 'An instance of a case type that represents a single unit of work',
    stage: 'A first-level of organizing a case life cycle that represents a major phase',
    process: 'A series of tasks that are performed in a specific order within a stage',
    step: 'An individual task within a process that can be a form, decision, or automation',
    assignment: 'A task that requires human action and appears in a worklist or workbasket',
    flow: 'A graphical representation of a business process that defines the sequence of steps',
    flowAction: 'A user-driven action that can be performed on an assignment',
    harness: 'A rule that defines the layout and content of a form',
    section: 'A reusable UI component that contains a group of related controls',
    dataPage: 'A rule that defines the source, structure, and scope of data',
    property: 'A rule that defines a field in a data structure',
    activity: 'A rule that defines a sequence of procedural operations',
    decisionRule: 'A rule that evaluates conditions and returns a result',
    whenRule: 'A rule that returns true or false based on conditions',
    declareExpression: 'A rule that automatically calculates a property value',
    correspondence: 'Communication sent to a party as part of case processing',
    serviceLevel: 'A rule that defines time-based milestones and actions',
    workbasket: 'A queue of assignments available to a group of users',
    worklist: 'A list of assignments assigned to a specific user',
  },

  // Rule types (Rule- classes)
  ruleTypes: {
    'Rule-Obj-CaseType': 'Case type definition',
    'Rule-Obj-Flow': 'Flow rule for process automation',
    'Rule-Obj-FlowAction': 'User action on assignment',
    'Rule-HTML-Section': 'UI section component',
    'Rule-HTML-Harness': 'Form harness template',
    'Rule-Obj-Property': 'Property/field definition',
    'Rule-Declare-Expression': 'Calculated property',
    'Rule-Declare-Index': 'Indexed property',
    'Rule-Obj-Activity': 'Procedural automation',
    'Rule-Obj-When': 'Conditional logic',
    'Rule-Decision-Table': 'Lookup table',
    'Rule-Decision-Tree': 'Decision tree',
    'Rule-Obj-ReportDefinition': 'Report definition',
    'Rule-Data-Page': 'Data page definition',
    'Rule-Service-REST': 'REST service',
    'Rule-Connect-REST': 'REST connector',
    'Rule-Service-Level': 'SLA definition',
    'Rule-Corr': 'Correspondence template',
    'Rule-Data-Transform': 'Data transformation',
    'Rule-Obj-Model': 'Default property values',
    'Rule-Access-Role-Obj': 'Access control',
    'Rule-Obj-Class': 'Class definition',
  },

  // UI patterns
  uiPatterns: {
    dynamicLayout: 'Flexible layout that arranges items in columns or rows',
    repeattive: 'Layout that displays a list of items in a grid or list format',
    embeddedsection: 'Section included within another section',
    inlinegrid: 'Grid layout that allows inline editing',
    tabbedlayout: 'Layout that organizes content in tabs',
    accordion: 'Expandable/collapsible sections',
    modal: 'Popup dialog overlay',
    sidebar: 'Navigation panel on the side',
    breadcrumb: 'Navigation trail showing current location',
    actionset: 'Group of actions triggered by user interaction',
  },

  // Data patterns
  dataPatterns: {
    dataPage: 'First-class data structure with defined source and scope',
    dataTransform: 'Rule that copies and transforms data',
    datapageDefinition: 'Defines structure and source of a data page',
    sourcedefinition: 'Source of data (report definition, lookup, connector)',
    loadManagement: 'How data page refresh is managed',
    scope: 'Thread, Requestor, or Node level data availability',
    snapshot: 'Point-in-time copy of data',
  },

  // Integration patterns
  integrationPatterns: {
    connect: 'Outbound integration to external system',
    service: 'Inbound integration from external system',
    mapper: 'Data mapping between Pega and external formats',
    requestor: 'Context for processing an interaction',
    serviceProvider: 'External system providing services',
    connector: 'Rule that calls external service',
  },

  // Common abbreviations
  abbreviations: {
    pz: 'Pega internal/reserved',
    py: 'Pega system property',
    px: 'Pega special property (read-only)',
    D_: 'Data page prefix',
    FW: 'Framework',
    Impl: 'Implementation',
    WO: 'Work Object',
    SLA: 'Service Level Agreement',
    FNOL: 'First Notice of Loss',
    STT: 'Straight Through Processing',
    CSR: 'Customer Service Representative',
    RFE: 'Request for Evidence',
    LOA: 'Leave of Absence',
    AML: 'Anti-Money Laundering',
    KYC: 'Know Your Customer',
    CDH: 'Customer Decision Hub',
    NBA: 'Next Best Action',
  },
};

// ============================================================================
// PEGA PROPERTY TYPE MAPPINGS
// ============================================================================

export const PROPERTY_TYPE_MAPPINGS = {
  // Pega property types to HTML input types
  toHtmlType: {
    Text: 'text',
    TextEncrypted: 'password',
    Password: 'password',
    Integer: 'number',
    Decimal: 'number',
    Double: 'number',
    Currency: 'number',
    Boolean: 'checkbox',
    Date: 'date',
    DateTime: 'datetime-local',
    TimeOfDay: 'time',
    PhoneNumber: 'tel',
    EmailAddress: 'email',
    URL: 'url',
    Identifier: 'text',
    Long: 'number',
  } as Record<string, string>,

  // Pega property types to semantic categories
  toSemanticCategory: {
    Text: 'text',
    TextEncrypted: 'sensitive',
    Password: 'sensitive',
    Integer: 'numeric',
    Decimal: 'numeric',
    Double: 'numeric',
    Currency: 'financial',
    Boolean: 'boolean',
    Date: 'date',
    DateTime: 'datetime',
    TimeOfDay: 'time',
    PhoneNumber: 'contact',
    EmailAddress: 'contact',
    URL: 'link',
    Identifier: 'identifier',
    Long: 'numeric',
  } as Record<string, string>,
};

// ============================================================================
// DOMAIN METADATA
// ============================================================================

export interface DomainMetadata {
  industry: string;
  subIndustry: string;
  typicalStages: string[];
  commonActors: string[];
  riskFactors: string[];
}

export const DOMAIN_METADATA: Record<string, DomainMetadata> = {
  'financial-lending': {
    industry: 'Financial Services',
    subIndustry: 'Lending',
    typicalStages: ['Application', 'Document Collection', 'Underwriting', 'Decision', 'Funding', 'Servicing'],
    commonActors: ['Loan Officer', 'Underwriter', 'Processor', 'Closer', 'Applicant'],
    riskFactors: ['Credit Risk', 'Fraud Risk', 'Compliance Risk', 'Interest Rate Risk'],
  },
  'insurance-claims': {
    industry: 'Insurance',
    subIndustry: 'Claims',
    typicalStages: ['FNOL', 'Investigation', 'Evaluation', 'Resolution', 'Payment', 'Recovery'],
    commonActors: ['Claims Adjuster', 'Examiner', 'Appraiser', 'Claimant', 'Agent'],
    riskFactors: ['Fraud Risk', 'Reserve Risk', 'Litigation Risk', 'SLA Breach'],
  },
  'banking-operations': {
    industry: 'Financial Services',
    subIndustry: 'Banking',
    typicalStages: ['Application', 'KYC/Verification', 'Approval', 'Account Setup', 'Activation'],
    commonActors: ['Banker', 'KYC Analyst', 'Operations', 'Customer', 'Compliance Officer'],
    riskFactors: ['AML Risk', 'Fraud Risk', 'Regulatory Risk', 'Operational Risk'],
  },
  'healthcare-patient': {
    industry: 'Healthcare',
    subIndustry: 'Patient Care',
    typicalStages: ['Intake', 'Assessment', 'Treatment Planning', 'Care Delivery', 'Follow-up', 'Discharge'],
    commonActors: ['Physician', 'Nurse', 'Care Coordinator', 'Patient', 'Specialist'],
    riskFactors: ['Patient Safety', 'Compliance (HIPAA)', 'Quality of Care', 'Readmission Risk'],
  },
  'healthcare-claims': {
    industry: 'Healthcare',
    subIndustry: 'Claims Adjudication',
    typicalStages: ['Submission', 'Validation', 'Adjudication', 'Payment', 'EOB Generation'],
    commonActors: ['Claims Examiner', 'Medical Reviewer', 'Provider', 'Member', 'COD Specialist'],
    riskFactors: ['Fraud Risk', 'Coding Errors', 'Timeliness (SLA)', 'Accuracy'],
  },
  'government-benefits': {
    industry: 'Government',
    subIndustry: 'Social Services',
    typicalStages: ['Application', 'Eligibility', 'Verification', 'Determination', 'Issuance', 'Renewal'],
    commonActors: ['Caseworker', 'Eligibility Specialist', 'Applicant', 'Supervisor', 'Auditor'],
    riskFactors: ['Fraud Risk', 'Timeliness', 'Eligibility Accuracy', 'Appeal Risk'],
  },
  'telecom-order': {
    industry: 'Communications',
    subIndustry: 'Order Management',
    typicalStages: ['Order Capture', 'Validation', 'Credit Check', 'Provisioning', 'Activation', 'Fulfillment'],
    commonActors: ['Sales Rep', 'Provisioning Specialist', 'Technician', 'Customer', 'CSR'],
    riskFactors: ['Churn Risk', 'Provisioning Failure', 'SLA Breach', 'Equipment Availability'],
  },
  'service-management': {
    industry: 'Technology',
    subIndustry: 'IT Service Management',
    typicalStages: ['Logging', 'Categorization', 'Assignment', 'Investigation', 'Resolution', 'Closure'],
    commonActors: ['Service Desk Agent', 'Incident Manager', 'Technical Specialist', 'User', 'CAB'],
    riskFactors: ['SLA Breach', 'Security Incident', 'Change Failure', 'Business Impact'],
  },
  'hr-onboarding': {
    industry: 'Human Resources',
    subIndustry: 'Employee Lifecycle',
    typicalStages: ['Offer', 'Acceptance', 'Background Check', 'Paperwork', 'Orientation', 'First Day'],
    commonActors: ['Recruiter', 'HR Specialist', 'Hiring Manager', 'New Hire', 'IT'],
    riskFactors: ['Compliance (I-9)', 'Background Check Failure', 'Delayed Start', 'Equipment Readiness'],
  },
  'procurement': {
    industry: 'Supply Chain',
    subIndustry: 'Procurement',
    typicalStages: ['Requisition', 'Approval', 'Sourcing', 'PO Creation', 'Receipt', 'Invoice', 'Payment'],
    commonActors: ['Requester', 'Buyer', 'Approver', 'Supplier', 'Accounts Payable'],
    riskFactors: ['Budget Overrun', 'Supplier Risk', 'Delivery Delay', 'Quality Issues'],
  },
  'customer-service': {
    industry: 'Cross-Industry',
    subIndustry: 'Customer Support',
    typicalStages: ['Intake', 'Triage', 'Investigation', 'Resolution', 'Follow-up', 'Closure'],
    commonActors: ['CSR', 'Supervisor', 'Specialist', 'Customer', 'Back Office'],
    riskFactors: ['Customer Dissatisfaction', 'Escalation', 'SLA Breach', 'First Contact Resolution'],
  },
  'legal-matter': {
    industry: 'Legal',
    subIndustry: 'Matter Management',
    typicalStages: ['Intake', 'Assessment', 'Research', 'Strategy', 'Execution', 'Resolution', 'Closure'],
    commonActors: ['Attorney', 'Paralegal', 'Client', 'Opposing Counsel', 'Court'],
    riskFactors: ['Conflict of Interest', 'Deadline Miss', 'Budget Overrun', 'Adverse Outcome'],
  },
  'manufacturing': {
    industry: 'Manufacturing',
    subIndustry: 'Production',
    typicalStages: ['Planning', 'Scheduling', 'Execution', 'QC', 'Completion', 'Delivery'],
    commonActors: ['Production Manager', 'Operator', 'Quality Inspector', 'Maintenance', 'Planner'],
    riskFactors: ['Quality Defects', 'Safety Incident', 'Equipment Failure', 'Schedule Delay'],
  },
  'utilities': {
    industry: 'Energy & Utilities',
    subIndustry: 'Service Delivery',
    typicalStages: ['Application', 'Site Survey', 'Installation', 'Activation', 'Billing', 'Service'],
    commonActors: ['Service Rep', 'Technician', 'Customer', 'Dispatch', 'Billing'],
    riskFactors: ['Outage Risk', 'Safety Risk', 'Regulatory Compliance', 'Customer Dissatisfaction'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Classify field for PII and semantic meaning
 */
export function classifyField(label: string | null, testId: string | null): {
  piiCategory: PiiCategory;
  semantic: string | null;
  pegaPropertyType: string | null;
} {
  const combined = `${label ?? ''} ${testId ?? ''}`.toLowerCase();

  for (const pattern of FIELD_PII_PATTERNS) {
    if (pattern.pattern.test(combined)) {
      return {
        piiCategory: pattern.piiCategory,
        semantic: pattern.semantic,
        pegaPropertyType: pattern.pegaPropertyType ?? null,
      };
    }
  }

  return { piiCategory: null, semantic: null, pegaPropertyType: null };
}

/**
 * Detect case domain from case class or type
 */
export function detectCaseDomain(caseClass: string | null): string | null {
  if (!caseClass) return null;

  for (const [domain, patterns] of Object.entries(CASE_DOMAIN_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(caseClass)) {
        return domain;
      }
    }
  }
  return null;
}

/**
 * Get domain metadata for a detected domain
 */
export function getDomainMetadata(domain: string | null): DomainMetadata | null {
  if (!domain) return null;
  return DOMAIN_METADATA[domain] ?? null;
}

/**
 * Get all available domains with their industry classifications
 */
export function getAllDomains(): Array<{ domain: string; industry: string; subIndustry: string }> {
  return Object.entries(DOMAIN_METADATA).map(([domain, meta]) => ({
    domain,
    industry: meta.industry,
    subIndustry: meta.subIndustry,
  }));
}

/**
 * Classify action button type from text
 */
export function classifyAction(buttonText: string | null): {
  actionType: ActionType;
  requiresConfirmation: boolean;
  isFlowAction: boolean;
  isLocalAction: boolean;
  isBulkAction: boolean;
} {
  if (!buttonText) {
    return {
      actionType: 'generic',
      requiresConfirmation: false,
      isFlowAction: false,
      isLocalAction: false,
      isBulkAction: false,
    };
  }

  const text = buttonText.toLowerCase();

  for (const actionPattern of ACTION_BUTTON_PATTERNS) {
    for (const pattern of actionPattern.patterns) {
      if (pattern.test(text)) {
        return {
          actionType: actionPattern.actionType,
          requiresConfirmation: actionPattern.requiresConfirmation,
          isFlowAction: actionPattern.isFlowAction ?? false,
          isLocalAction: actionPattern.isLocalAction ?? false,
          isBulkAction: actionPattern.isBulkAction ?? false,
        };
      }
    }
  }

  return {
    actionType: 'generic',
    requiresConfirmation: false,
    isFlowAction: false,
    isLocalAction: false,
    isBulkAction: false,
  };
}

/**
 * Extract case ID from URL using multiple patterns
 */
export function extractCaseIdFromUrl(url: string): string | null {
  // Try pathCaseId pattern first (most specific for URLs like /death-claims/DEATHCLAIM-3231)
  const pathMatch = url.match(URL_PATTERNS.caseId.pathCaseId);
  if (pathMatch?.[2]) return pathMatch[2];

  // Try other case ID patterns
  for (const [key, pattern] of Object.entries(URL_PATTERNS.caseId)) {
    if (key === 'pathCaseId') continue; // Already tried
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  // Try work object pattern
  const workMatch = url.match(WORK_OBJECT_PATTERN);
  if (workMatch?.[0]) return workMatch[0];

  return null;
}

/**
 * Infer field label using priority methods
 */
export function inferFieldLabel(element: HTMLElement, testId: string | null): string {
  // 1. Try aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // 2. Try for attribute (label with for=id)
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label?.textContent) return label.textContent.trim();
  }

  // 3. Try data-label attribute
  const dataLabel = element.getAttribute('data-label');
  if (dataLabel) return dataLabel;

  // 4. Try previous sibling
  const prevSibling = element.previousElementSibling;
  if (prevSibling?.tagName === 'LABEL' && prevSibling.textContent) {
    return prevSibling.textContent.trim();
  }

  // 5. Try parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const labelText = Array.from(parentLabel.childNodes)
      .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() ?? '')
      .join(' ')
      .trim();
    if (labelText) return labelText;
  }

  // 6. Try placeholder
  const placeholder = (element as HTMLInputElement).placeholder;
  if (placeholder) return placeholder;

  // 7. Split testId - Convert "Field_FirstName" or "FirstName" to "First Name"
  if (testId) {
    const cleaned = testId.replace(/^(Field_|Button_|Action_)/i, '');
    const parts = cleaned.split(/(?=[A-Z])/);
    return parts.join(' ').trim();
  }

  return '';
}

/**
 * Determine UI framework from detected selectors
 */
export function determineUIFramework(
  constellationDetected: boolean,
  classicDetected: boolean,
  cosmosDetected: boolean
): UIFramework {
  if (constellationDetected) return 'constellation';
  if (cosmosDetected) return 'cosmos';
  if (classicDetected) return 'classic';
  return 'unknown';
}

/**
 * Detect UI framework from DOM
 */
export function detectUIFramework(): UIFramework {
  for (const selector of PEGA_CONSTELLATION_SELECTORS) {
    if (document.querySelector(selector)) return 'constellation';
  }
  for (const selector of PEGA_COSMOS_SELECTORS) {
    if (document.querySelector(selector)) return 'cosmos';
  }
  for (const selector of PEGA_CLASSIC_SELECTORS) {
    if (document.querySelector(selector)) return 'classic';
  }
  return 'unknown';
}

/**
 * Parse work object ID and extract components
 */
export function parseWorkObjectId(woId: string): {
  prefix: string;
  id: string;
  fullId: string;
  caseType: string | null;
} | null {
  const match = woId.match(WORK_OBJECT_PATTERN);
  if (!match) return null;

  const [, prefix, id] = match;

  // Try to infer case type from prefix
  let caseType: string | null = null;
  if (prefix) {
    for (const [type, pattern] of Object.entries(WORK_OBJECT_PATTERNS.casePrefixes)) {
      if (pattern.test(prefix)) {
        caseType = type;
        break;
      }
    }
  }

  return {
    prefix: prefix ?? '',
    id: id ?? '',
    fullId: match[0],
    caseType,
  };
}

/**
 * Validate class hierarchy pattern
 */
export function isValidClassHierarchy(className: string): boolean {
  return WORK_OBJECT_PATTERNS.classHierarchy.test(className);
}

/**
 * Parse Pega class name into components
 */
export function parsePegaClassName(className: string): {
  org: string;
  div: string;
  unit: string;
  workType: string | null;
  isFramework: boolean;
  isImplementation: boolean;
  isDataClass: boolean;
} | null {
  const parts = className.split('-');
  if (parts.length < 3) return null;

  return {
    org: parts[0] ?? '',
    div: parts[1] ?? '',
    unit: parts[2] ?? '',
    workType: parts.length > 3 ? parts.slice(3).join('-') : null,
    isFramework: WORK_OBJECT_PATTERNS.classPatterns.framework.test(className),
    isImplementation: WORK_OBJECT_PATTERNS.classPatterns.implementation.test(className),
    isDataClass: WORK_OBJECT_PATTERNS.classPatterns.data.test(className),
  };
}

/**
 * Detect assignment type from context
 */
export function detectAssignmentType(assignmentText: string): string | null {
  for (const [type, pattern] of Object.entries(ASSIGNMENT_PATTERNS.assignmentTypes)) {
    if (pattern.test(assignmentText)) {
      return type;
    }
  }
  return null;
}

/**
 * Detect routing method from context
 */
export function detectRoutingMethod(routingText: string): string | null {
  for (const [method, pattern] of Object.entries(ASSIGNMENT_PATTERNS.routingMethods)) {
    if (pattern.test(routingText)) {
      return method;
    }
  }
  return null;
}

/**
 * Parse SLA interval and extract timing
 */
export function parseSLAInterval(slaText: string): {
  interval: string | null;
  timeValue: number | null;
  timeUnit: string | null;
} {
  let interval: string | null = null;
  let timeValue: number | null = null;
  let timeUnit: string | null = null;

  // Detect interval type
  for (const [type, pattern] of Object.entries(SLA_PATTERNS.intervals)) {
    if (pattern.test(slaText)) {
      interval = type;
      break;
    }
  }

  // Extract time value and unit
  const timeMatch = slaText.match(/(\d+)\s*(minute|hour|day|business)/i);
  if (timeMatch) {
    timeValue = parseInt(timeMatch[1] ?? '0', 10);
    timeUnit = (timeMatch[2] ?? '').toLowerCase();
  }

  return { interval, timeValue, timeUnit };
}

/**
 * Calculate urgency level from numeric value
 */
export function getUrgencyLevel(urgency: number): string {
  if (urgency >= 90) return 'critical';
  if (urgency >= 70) return 'high';
  if (urgency >= 40) return 'medium';
  return 'low';
}

/**
 * Detect correspondence type from context
 */
export function detectCorrespondenceType(corrText: string): string | null {
  for (const [type, pattern] of Object.entries(CORRESPONDENCE_PATTERNS.types)) {
    if (pattern.test(corrText)) {
      return type;
    }
  }
  return null;
}

/**
 * Validate data page name
 */
export function isValidDataPageName(name: string): boolean {
  return DATA_PAGE_PATTERNS.namingConventions.lookup.test(name);
}

/**
 * Parse data page name to extract type
 */
export function parseDataPageName(name: string): {
  isValid: boolean;
  pageType: string | null;
  isList: boolean;
  isPage: boolean;
} {
  const isValid = isValidDataPageName(name);
  const isList = DATA_PAGE_PATTERNS.namingConventions.list.test(name);
  const isPage = DATA_PAGE_PATTERNS.namingConventions.page.test(name);

  let pageType: string | null = null;
  if (isList) pageType = 'list';
  else if (isPage) pageType = 'page';
  else if (isValid) pageType = 'singular';

  return { isValid, pageType, isList, isPage };
}

/**
 * Detect flow type from context
 */
export function detectFlowType(flowText: string): string | null {
  for (const [type, pattern] of Object.entries(FLOW_PATTERNS.flowTypes)) {
    if (pattern.test(flowText)) {
      return type;
    }
  }
  return null;
}

/**
 * Detect connector type from context
 */
export function detectConnectorType(connectorText: string): string | null {
  for (const [type, pattern] of Object.entries(FLOW_PATTERNS.connectorTypes)) {
    if (pattern.test(connectorText)) {
      return type;
    }
  }
  return null;
}

/**
 * Detect decision rule type
 */
export function detectDecisionRuleType(ruleText: string): string | null {
  for (const [type, pattern] of Object.entries(DECISION_PATTERNS.ruleTypes)) {
    if (pattern.test(ruleText)) {
      return type;
    }
  }
  return null;
}

/**
 * Detect integration type
 */
export function detectIntegrationType(integrationText: string): string | null {
  for (const [type, pattern] of Object.entries(INTEGRATION_PATTERNS.connectorTypes)) {
    if (pattern.test(integrationText)) {
      return type;
    }
  }
  return null;
}

/**
 * Detect portal type from DOM
 */
export function detectPortalType(): string | null {
  for (const [type, selectors] of Object.entries(PORTAL_PATTERNS.portalSelectors)) {
    for (const selector of selectors) {
      if (document.querySelector(selector)) {
        return type;
      }
    }
  }
  return null;
}

/**
 * Detect validation error type from message
 */
export function detectValidationError(errorText: string): string | null {
  for (const [type, pattern] of Object.entries(ERROR_PATTERNS.validationTypes)) {
    if (pattern.test(errorText)) {
      return type;
    }
  }
  return null;
}

/**
 * Check if element has validation errors
 */
export function hasValidationErrors(element: HTMLElement): boolean {
  for (const selector of ERROR_PATTERNS.errorSelectors) {
    if (element.querySelector(selector) || element.matches(selector)) {
      return true;
    }
  }
  return false;
}

/**
 * Detect Pega API endpoint type
 */
export function detectApiEndpointType(url: string): string | null {
  for (const [type, pattern] of Object.entries(PEGA_API_PATTERNS.endpoints)) {
    if (pattern.test(url)) {
      return type;
    }
  }
  return null;
}

/**
 * Get HTML input type for Pega property type
 */
export function pegaPropertyToHtmlType(pegaType: string): string {
  return PROPERTY_TYPE_MAPPINGS.toHtmlType[pegaType] ?? 'text';
}

/**
 * Get semantic category for Pega property type
 */
export function pegaPropertyToSemantic(pegaType: string): string {
  return PROPERTY_TYPE_MAPPINGS.toSemanticCategory[pegaType] ?? 'text';
}

/**
 * Detect case lifecycle stage from text
 */
export function detectLifecycleStage(stageText: string): string | null {
  for (const [stage, pattern] of Object.entries(CASE_LIFECYCLE_PATTERNS.commonStages)) {
    if (pattern.some(p => p.test(stageText))) {
      return stage;
    }
  }
  return null;
}

/**
 * Detect stage status
 */
export function detectStageStatus(statusText: string): string | null {
  for (const [status, pattern] of Object.entries(CASE_LIFECYCLE_PATTERNS.stageStatus)) {
    if (pattern.some(p => p.test(statusText))) {
      return status;
    }
  }
  return null;
}

/**
 * Detect SLA status
 */
export function detectSLAStatus(slaText: string): string | null {
  for (const [status, pattern] of Object.entries(SLA_PATTERNS.slaStatus)) {
    if (pattern.test(slaText)) {
      return status;
    }
  }
  return null;
}

/**
 * Get Pega terminology explanation
 */
export function getPegaTermDefinition(term: string): string | null {
  const normalizedTerm = term.toLowerCase().replace(/[-\s]/g, '');
  for (const [key, definition] of Object.entries(PEGA_TERMINOLOGY.concepts)) {
    if (key.toLowerCase().replace(/[-\s]/g, '') === normalizedTerm) {
      return definition;
    }
  }
  return null;
}

/**
 * Get Pega rule type description
 */
export function getRuleTypeDescription(ruleType: string): string | null {
  return (PEGA_TERMINOLOGY.ruleTypes as Record<string, string>)[ruleType] ?? null;
}

/**
 * Expand Pega abbreviation
 */
export function expandPegaAbbreviation(abbr: string): string | null {
  const normalizedAbbr = abbr.toUpperCase();
  return (PEGA_TERMINOLOGY.abbreviations as Record<string, string>)[normalizedAbbr] ?? null;
}

/**
 * Check if URL is Pega cloud
 */
export function isPegaCloudUrl(url: string): boolean {
  return URL_PATTERNS.urlSegments.pegaCloud.test(url);
}

/**
 * Get all selectors for a component type
 */
export function getComponentSelectors(componentType: keyof typeof PEGA_COMPONENT_SELECTORS): string[] {
  return PEGA_COMPONENT_SELECTORS[componentType] ?? [];
}

/**
 * Check if test ID matches a pattern type
 */
export function matchTestIdPattern(testId: string): { type: string; matches: boolean } | null {
  for (const [type, pattern] of Object.entries(PEGA_TEST_ID_PATTERNS)) {
    if (pattern.test(testId)) {
      return { type, matches: true };
    }
  }
  return null;
}

/**
 * Generate a comprehensive case context from DOM
 */
export function extractCaseContextFromDOM(): {
  caseId: string | null;
  caseType: string | null;
  stage: string | null;
  status: string | null;
  uiFramework: UIFramework;
  portalType: string | null;
} {
  const url = window.location.href;

  return {
    caseId: extractCaseIdFromUrl(url),
    caseType: null, // Would need DOM parsing
    stage: null, // Would need DOM parsing
    status: null, // Would need DOM parsing
    uiFramework: detectUIFramework(),
    portalType: detectPortalType(),
  };
}
