#!/usr/bin/env bash
# Smoke-test closed clinical loop against local API
set -e
API="${API_BASE:-http://localhost:4000}"
FAC="${FACILITY_ID:-AKS-IBOM-SPECIALIST}"

echo "== MedCore clinical loop demo =="
echo "API: $API  Facility: $FAC"
echo ""

echo "1) Health"
curl -s "$API/health" | head -c 200
echo ""
echo ""

echo "2) Lab CRITICAL result → LAB_RESULT_READY"
curl -s -X POST "$API/api/v1/lab/results" \
  -H 'Content-Type: application/json' \
  -d "{
    \"patientId\":\"PAT-DEMO-1\",
    \"patientName\":\"Uduak Essen\",
    \"facilityId\":\"$FAC\",
    \"testName\":\"Troponin I\",
    \"results\":[{\"parameter\":\"Troponin I\",\"value\":\"2.1\",\"unit\":\"ng/mL\",\"referenceRange\":\"<0.04\",\"flag\":\"CRITICAL\"}],
    \"verifiedBy\":\"Lab Tech\"
  }"
echo ""
echo ""

echo "3) HMO eligibility (AKSHIA)"
curl -s -X POST "$API/api/v1/hmo/eligibility" \
  -H 'Content-Type: application/json' \
  -d "{\"policyId\":\"AKSHIA-POL-88201\",\"facilityId\":\"$FAC\"}"
echo ""
echo ""

echo "4) SMS patient alert"
curl -s -X POST "$API/api/v1/comms/sms/send" \
  -H 'Content-Type: application/json' \
  -d '{
    "phoneNumber":"+2348030000000",
    "recipientName":"Uduak Essen",
    "message":"MedCore: Your lab result (Troponin I) is ready. Please proceed to the clinic.",
    "category":"LAB_RESULT"
  }'
echo ""
echo ""

echo "Done. Watch Hospital OS top bar LIVE + notification bell."
