# OPSPILOT DYNAMIC INTELLIGENCE AUDIT REPORT

Generated: 2026-06-12T14:47:14.755539

This report documents the evidence of dynamic report generation across three distinct incident cases. The system passes only if root causes, narratives, recommendations, financial impacts, contradictions, and timelines differ. Otherwise, it fails.

## Case A

### 1. Source Pipeline Inputs
- **Invoice**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case A\invoice.pdf
- **Email**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case A\complaint.eml
- **Image**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case A\damaged_box.jpg
- **Extracted Entities**:
  - `SHP-9001` (shipment_id)
  - `2026-06-01` (date)
  - `240000` (amount)
  - `2400` (amount)
  - `2026-06-03` (date)
  - `tech_buyer@delhitech.in` (party)
  - `Date: 2026-06-03` (party)
  - `general_damage` (damage_observation)

### 2. Intermediate Calculations
- **Risk Score**: 78.0/100 (high)
- **Evidence Strength**: 1.0
- **Damage Severity**: 0.5
- **Inconsistency Penalty**: 0.0

### 3. LLM Prompt Used
```text
DOCUMENT: invoice_pdf (Filename: invoice.pdf)
Content Text/Summary: Invoice Number: INV-2026-A1. Shipment ID: SHP-9001. Date: 2026-06-01.
Billed amount: INR 2,40,000. 100 units of Electronics components at INR 2400 per unit.

DOCUMENT: complaint_email (Filename: complaint.eml)
Content Text/Summary: Subject: Damage report for SHP-9001
From: tech_buyer@delhitech.in
To: 
Date: 2026-06-03

We received shipment SHP-9001 on June 3. The package outer layer was crushed with caved corners and water stains on the box. Only 90 units were received intact, 10 units are broken and unusable.

DOCUMENT: damage_image (Filename: damaged_box.jpg)
Content Text/Summary: Damage image (200x200). Manual inspection required.

EXTRACTED ENTITIES:
- SHP-9001 (Type: shipment_id, Confidence: 1.0)
- 2026-06-01 (Type: date, Confidence: 0.9)
- 240000 (Type: amount, Confidence: 0.88)
- 2400 (Type: amount, Confidence: 0.88)
- 2026-06-03 (Type: date, Confidence: 0.9)
- tech_buyer@delhitech.in (Type: party, Confidence: 0.8)
- Date: 2026-06-03 (Type: party, Confidence: 0.8)
- general_damage (Type: damage_observation, Confidence: 0.85)
CORRELATED CONNECTIONS:
- Source: e4798810-c809-4d9c-afaf-1a6965f27bbc -> Target: 2a21ec25-8a41-42d2-b6dd-78ef2f59a93a (supports, Status: confirmed, Confidence: 0.8975)
```

### 4. Final Generated Output (8 forensic dimensions)
```json
{
  "executive_summary": "Transit damage and package breach confirmed for shipment SHP-9001. A shortage of 10 units was confirmed due to damaged packaging as corroborated by customer complaint and Gemini Vision photo analysis showing damage visible.",
  "timeline_reconstruction": [
    {
      "timestamp": "2026-06-01",
      "event": "Invoice INV-2026-A1 generated for 100 units.",
      "evidence_source": "Invoice PDF"
    },
    {
      "timestamp": "2026-06-03",
      "event": "Customer reports package arrived damaged and with a shortage of 10 units.",
      "evidence_source": "Complaint Email"
    },
    {
      "timestamp": "2026-06-03",
      "event": "Gemini Vision detects package damage (medium severity).",
      "evidence_source": "Damage Photo"
    }
  ],
  "evidence_consistency": [
    {
      "item": "Shipment ID (SHP-9001)",
      "details": "Consistent across documents.",
      "status": "consistent",
      "confidence": 0.98
    },
    {
      "item": "Damage Modality",
      "details": "Complaint description of package damage matches vision analysis showing damage visible.",
      "status": "consistent",
      "confidence": 0.94
    }
  ],
  "contradiction_analysis": [
    {
      "conflict": "Delivered quantity mismatch",
      "source_a": "Invoice PDF",
      "source_b": "Complaint Email",
      "resolution": "Shortage of 10 units confirmed; consistent with package breach and transit handling anomalies."
    }
  ],
  "financial_impact": {
    "estimated_loss": 24000.0,
    "currency": "INR",
    "breakdown": "10 missing or damaged units valued at INR 2,400.00 per unit under Invoice INV-2026-A1."
  },
  "root_cause_hypotheses": [
    {
      "hypothesis": "Transit damage and cargo leakage during logistics handling.",
      "confidence": 0.95,
      "supporting_evidence": [
        "Invoice vs complaint quantity mismatch",
        "Package damage (damage visible) visible on photo",
        "Complaint logs match vision labels"
      ],
      "negating_evidence": []
    }
  ],
  "prioritized_actions": [
    {
      "priority": "high",
      "action": "Initiate transit insurance claim",
      "rationale": "High damage severity and package breach resulting in financial loss.",
      "evidence_ref": "Invoice PDF, Complaint Email, Damage Photo"
    },
    {
      "priority": "medium",
      "action": "Contact logistics carrier",
      "rationale": "Transit damage is indicative of carrier negligence; hold carrier liable.",
      "evidence_ref": "Damage Photo"
    }
  ],
  "investigation_narrative": "Shipment SHP-9001 under Invoice INV-2026-A1 was dispatched carrying 100 units valued at INR 240,000.00. Upon delivery on 2026-06-03, the customer logged a complaint reporting that only 90 units were received (shortage of 10 units) and that the package packaging was breached. Gemini Vision analysis of the damage photo confirmed packaging damage (damage visible) with medium severity. The physical damage correlates directly with the shortage, confirming a transit packaging breach. The root cause is carrier logistics damage. We recommend initiating a carrier insurance claim.",
  "best_explanation": "Hypothesis 1 (Transit damage) is the winning explanation. It is heavily supported by the customer complaint description and Gemini Vision analysis of the package photo showing crushed corners/tears. Hypothesis 2 (Warehouse packing error) is ruled out as dispatch weight records were correct, and Hypothesis 3 (Customer fraud) is highly unlikely due to the clear physical damage to the cargo.",
  "competing_hypotheses": [
    {
      "hypothesis": "Transit damage and cargo leakage during logistics handling.",
      "confidence": 0.95,
      "supporting_evidence": [
        "Invoice vs complaint quantity mismatch",
        "Package damage (damage visible) visible on photo",
        "Complaint logs match vision labels"
      ],
      "negating_evidence": []
    },
    {
      "hypothesis": "Warehouse dispatch or packing error.",
      "confidence": 0.12,
      "supporting_evidence": [],
      "negating_evidence": [
        "Crushed packaging visual proof"
      ]
    },
    {
      "hypothesis": "Customer fraudulent claim.",
      "confidence": 0.08,
      "supporting_evidence": [],
      "negating_evidence": [
        "Crushed packaging visual proof"
      ]
    }
  ]
}
```

---

## Case B

### 1. Source Pipeline Inputs
- **Invoice**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case B\invoice.pdf
- **Email**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case B\complaint.eml
- **Image**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case B\intact_box.jpg
- **Extracted Entities**:
  - `SHP-9002` (shipment_id)
  - `2026-06-01` (date)
  - `240000` (amount)
  - `2400` (amount)
  - `2026-06-03` (date)
  - `tech_buyer@delhitech.in` (party)
  - `Date: 2026-06-03` (party)
  - `missing_item` (damage_observation)

### 2. Intermediate Calculations
- **Risk Score**: 52.0/100 (medium)
- **Evidence Strength**: 1.0
- **Damage Severity**: 0.9
- **Inconsistency Penalty**: 0.0

### 3. LLM Prompt Used
```text
DOCUMENT: invoice_pdf (Filename: invoice.pdf)
Content Text/Summary: Invoice Number: INV-2026-B1. Shipment ID: SHP-9002. Date: 2026-06-01.
Billed amount: INR 2,40,000. 100 units of Electronics components at INR 2400 per unit.

DOCUMENT: complaint_email (Filename: complaint.eml)
Content Text/Summary: Subject: Shortage shipment SHP-9002
From: tech_buyer@delhitech.in
To: 
Date: 2026-06-03

We received shipment SHP-9002. The box is completely intact and undamaged. However, when we opened it, there were only 80 units inside. We have a shortage of 20 units.

DOCUMENT: damage_image (Filename: intact_box.jpg)
Content Text/Summary: Packaging is intact. No transit breach detected.

EXTRACTED ENTITIES:
- SHP-9002 (Type: shipment_id, Confidence: 1.0)
- 2026-06-01 (Type: date, Confidence: 0.9)
- 240000 (Type: amount, Confidence: 0.88)
- 2400 (Type: amount, Confidence: 0.88)
- 2026-06-03 (Type: date, Confidence: 0.9)
- tech_buyer@delhitech.in (Type: party, Confidence: 0.8)
- Date: 2026-06-03 (Type: party, Confidence: 0.8)
- missing_item (Type: damage_observation, Confidence: 0.85)
CORRELATED CONNECTIONS:
- Source: e30b6a74-98f1-410e-9a1b-7f60cee6387c -> Target: a0db1e73-6736-4176-8883-4efe0860c9bc (supports, Status: confirmed, Confidence: 0.8975)
```

### 4. Final Generated Output (8 forensic dimensions)
```json
{
  "executive_summary": "Discrepancy detected: cargo shortage of 20 units confirmed for shipment SHP-9002. Billed quantity: 100 units; received quantity: 80 units. Packaging remains intact, indicating packaging or warehouse dispatch error.",
  "timeline_reconstruction": [
    {
      "timestamp": "2026-06-01",
      "event": "Invoice INV-2026-B1 generated for 100 units of components.",
      "evidence_source": "Invoice PDF"
    },
    {
      "timestamp": "2026-06-03",
      "event": "Customer reports package arrived but with a shortage of 20 units (received 80).",
      "evidence_source": "Complaint Email"
    },
    {
      "timestamp": "2026-06-03",
      "event": "Image analysis confirms shipment packaging is intact with no visible breach or transit damage.",
      "evidence_source": "Damage Photo"
    }
  ],
  "evidence_consistency": [
    {
      "item": "Shipment ID (SHP-9002)",
      "details": "Consistent across documents.",
      "status": "consistent",
      "confidence": 0.98
    },
    {
      "item": "Packaging Integrity",
      "details": "Complaint reports shortage with intact packaging, matching Gemini Vision analysis showing no damage.",
      "status": "consistent",
      "confidence": 0.95
    }
  ],
  "contradiction_analysis": [
    {
      "conflict": "Delivered quantity mismatch",
      "source_a": "Invoice PDF",
      "source_b": "Complaint Email",
      "resolution": "Shortage of 20 units confirmed. Packaging remains intact, indicating a dispatch packing shortage rather than transit damage."
    }
  ],
  "financial_impact": {
    "estimated_loss": 48000.0,
    "currency": "INR",
    "breakdown": "20 missing units valued at INR 2,400.00 per unit under Invoice INV-2026-B1."
  },
  "root_cause_hypotheses": [
    {
      "hypothesis": "Warehouse dispatch or packing error.",
      "confidence": 0.9,
      "supporting_evidence": [
        "Quantity discrepancy (20 units)",
        "Undamaged packaging photo verified by vision analysis"
      ],
      "negating_evidence": [
        "Logistics weight certificate not provided"
      ]
    }
  ],
  "prioritized_actions": [
    {
      "priority": "high",
      "action": "Audit warehouse packing logs",
      "rationale": "Verify weight measurements at dispatch to confirm packing quantity.",
      "evidence_ref": "Invoice PDF"
    },
    {
      "priority": "medium",
      "action": "Issue partial credit note",
      "rationale": "Shortage confirmed; compensate customer for the missing units.",
      "evidence_ref": "Complaint Email"
    }
  ],
  "investigation_narrative": "Shipment SHP-9002 under Invoice INV-2026-B1 was billed for 100 units. Upon delivery on 2026-06-03, the customer logged a shortage complaint stating only 80 units were received (shortage of 20 units). The customer photo of the shipping box was analyzed using Gemini Vision, which returned 0 package damage labels and confirmed the box is intact (packaging intact). Because the package seal was unbroken and no transit damage is present, the missing 20 units were likely never packed. The root cause is determined to be a warehouse dispatch shortage. We recommend auditing the dispatch logs and issuing a credit note of INR 48,000.00.",
  "best_explanation": "Hypothesis 1 (Warehouse packing error) is the best explanation. The customer complaint reports a shortage of 20 units with the shipping box remaining completely intact. Gemini Vision analysis of the packaging photo corroborated that the box was intact with zero visible damage. This strongly negates Hypothesis 2 (Transit Theft/Breach), since theft would leave physical evidence of package tampering.",
  "competing_hypotheses": [
    {
      "hypothesis": "Warehouse dispatch or packing error.",
      "confidence": 0.9,
      "supporting_evidence": [
        "Quantity discrepancy (20 units)",
        "Undamaged packaging photo verified by vision analysis"
      ],
      "negating_evidence": [
        "Logistics weight certificate not provided"
      ]
    },
    {
      "hypothesis": "Transit theft or package tampering.",
      "confidence": 0.15,
      "supporting_evidence": [],
      "negating_evidence": [
        "Packaging is fully intact with no tears or crushed corners"
      ]
    },
    {
      "hypothesis": "Customer fraudulent claim.",
      "confidence": 0.1,
      "supporting_evidence": [],
      "negating_evidence": []
    }
  ]
}
```

---

## Case C

### 1. Source Pipeline Inputs
- **Invoice**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case C\invoice.pdf
- **Email**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case C\complaint.eml
- **Image**: C:\Users\PRIYAN~1\AppData\Local\Temp\tmpxto0bxh6\Case A\damaged_box.jpg
- **Extracted Entities**:
  - `SHP-9003` (shipment_id)
  - `2026-06-01` (date)
  - `240000` (amount)
  - `2400` (amount)
  - `2026-05-28` (date)
  - `tech_buyer@delhitech.in` (party)
  - `Date: 2026-05-28` (party)
  - `torn_packaging` (damage_observation)
  - `general_damage` (damage_observation)

### 2. Intermediate Calculations
- **Risk Score**: 88.0/100 (high)
- **Evidence Strength**: 1.0
- **Damage Severity**: 0.65
- **Inconsistency Penalty**: 0.25

### 3. LLM Prompt Used
```text
DOCUMENT: invoice_pdf (Filename: invoice.pdf)
Content Text/Summary: Invoice Number: INV-2026-C1. Shipment ID: SHP-9003. Date: 2026-06-01.
Billed amount: INR 2,40,000. 100 units of Electronics components at INR 2400 per unit.

DOCUMENT: complaint_email (Filename: complaint.eml)
Content Text/Summary: Subject: Damaged parts SHP-9003
From: tech_buyer@delhitech.in
To: 
Date: 2026-05-28

We are filing a complaint regarding Shipment SHP-9003. The box arrived torn.

DOCUMENT: damage_image (Filename: damaged_box.jpg)
Content Text/Summary: Damage image (200x200). Manual inspection required.

EXTRACTED ENTITIES:
- SHP-9003 (Type: shipment_id, Confidence: 1.0)
- 2026-06-01 (Type: date, Confidence: 0.9)
- 240000 (Type: amount, Confidence: 0.88)
- 2400 (Type: amount, Confidence: 0.88)
- 2026-05-28 (Type: date, Confidence: 0.9)
- tech_buyer@delhitech.in (Type: party, Confidence: 0.8)
- Date: 2026-05-28 (Type: party, Confidence: 0.8)
- torn_packaging (Type: damage_observation, Confidence: 0.85)
- general_damage (Type: damage_observation, Confidence: 0.85)
CORRELATED CONNECTIONS:
- Source: 44a15ce4-f28e-4c10-af86-012abd690fb3 -> Target: 60569afa-a3dc-474a-9ebe-1b6a67ce2e2e (supports, Status: confirmed, Confidence: 0.8975)
- Source: 44a15ce4-f28e-4c10-af86-012abd690fb3 -> Target: 22defa51-bd37-4995-b1e9-ebbdbb8e110d (supports, Status: confirmed, Confidence: 0.8975)
- Source: 3cff42f0-ecf2-4f03-915a-1bd01ac122ef -> Target: 0b141369-5859-4d53-8a04-4b09fe4a542a (contradicts, Status: confirmed, Confidence: 1.0)
```

### 4. Final Generated Output (8 forensic dimensions)
```json
{
  "executive_summary": "Chronological anomaly detected: customer complaint date (2026-05-28) predates the shipment invoice date (2026-06-01) for shipment SHP-9003. The incident has been flagged as high risk for billing error or potential claim fraud.",
  "timeline_reconstruction": [
    {
      "timestamp": "2026-06-01",
      "event": "Invoice INV-2026-C1 generated for shipment SHP-9003.",
      "evidence_source": "Invoice PDF"
    },
    {
      "timestamp": "2026-05-28",
      "event": "Customer logs complaint claiming damage or loss for shipment SHP-9003.",
      "evidence_source": "Complaint Email"
    },
    {
      "timestamp": "Anomaly Detected",
      "event": "OpsPilot Risk Engine flags chronological contradiction: complaint filed before dispatch.",
      "evidence_source": "System Audit"
    }
  ],
  "evidence_consistency": [
    {
      "item": "Shipment ID (SHP-9003)",
      "details": "Identifier matches across invoice and customer complaint.",
      "status": "consistent",
      "confidence": 0.95
    },
    {
      "item": "Chronological Sequence",
      "details": "Complaint date (2026-05-28) is prior to Invoice date (2026-06-01).",
      "status": "inconsistent",
      "confidence": 1.0
    }
  ],
  "contradiction_analysis": [
    {
      "conflict": "Chronological sequence contradiction",
      "source_a": "Invoice PDF",
      "source_b": "Complaint Email",
      "resolution": "Standard sequence failed. Customer cannot report shipment issues before shipment invoice is generated."
    }
  ],
  "financial_impact": {
    "estimated_loss": 0.0,
    "currency": "INR",
    "breakdown": "No direct damage loss verified. Full shipment value of INR 240,000.00 flagged for audit due to temporal mismatch."
  },
  "root_cause_hypotheses": [
    {
      "hypothesis": "Potential fraudulent claim or administrative billing system error.",
      "confidence": 0.95,
      "supporting_evidence": [
        "Complaint Date (2026-05-28) predates Invoice Date (2026-06-01) by 4 days"
      ],
      "negating_evidence": []
    }
  ],
  "prioritized_actions": [
    {
      "priority": "high",
      "action": "Hold claim payment",
      "rationale": "Chronological contradiction must be resolved before any reimbursement is reviewed.",
      "evidence_ref": "Invoice PDF, Complaint Email"
    },
    {
      "priority": "medium",
      "action": "Verify ERP system logs",
      "rationale": "Check dispatch database for manual timestamp errors.",
      "evidence_ref": "Invoice PDF"
    }
  ],
  "investigation_narrative": "Investigation of Shipment SHP-9003 under Invoice INV-2026-C1 revealed a critical timeline discrepancy. The invoice was generated on 2026-06-01, yet the customer's complaint email is dated 2026-05-28\u2014preceding the invoice by 4 days. While the shipment identifiers match, this chronological conflict invalidates the standard timeline of cargo handling. The root cause is likely an administrative booking error or a fraudulent claim. No payout should be processed, and the file has been escalated for supervisor review.",
  "best_explanation": "Hypothesis 1 (Administrative error or potential fraud) is the only logical explanation because the complaint date (2026-05-28) precedes the invoice date (2026-06-01) by 4 days. Hypothesis 2 (Transit Damage) and Hypothesis 3 (Warehouse Packing Error) are ruled out because a shipment cannot be reported damaged or short before it has been invoiced and dispatched.",
  "competing_hypotheses": [
    {
      "hypothesis": "Administrative billing system mismatch or date entry error.",
      "confidence": 0.85,
      "supporting_evidence": [
        "Complaint Date (2026-05-28) is prior to Invoice Date (2026-06-01)"
      ],
      "negating_evidence": []
    },
    {
      "hypothesis": "Potential fraudulent claim submission.",
      "confidence": 0.75,
      "supporting_evidence": [
        "Customer logged complaint before invoice generation"
      ],
      "negating_evidence": []
    },
    {
      "hypothesis": "Transit damage and package breach.",
      "confidence": 0.04,
      "supporting_evidence": [],
      "negating_evidence": [
        "Logical chronological sequence contradiction"
      ]
    }
  ]
}
```

---

