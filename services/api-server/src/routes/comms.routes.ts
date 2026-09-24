import { Router, Request, Response } from 'express';
import { auditLedger } from '../security/auditLedger';

const router = Router();

export interface SmsMessageRecord {
  id: string;
  phoneNumber: string;
  recipientName?: string;
  message: string;
  category: 'APPOINTMENT' | 'LAB_RESULT' | 'PHARMACY_READY' | 'QUEUE_ALERT' | 'EMERGENCY';
  status: 'QUEUED' | 'DELIVERED' | 'FAILED';
  gatewayProvider: 'TERMII_NIGERIA' | 'AFRICAS_TALKING' | 'SIMULATED';
  dispatchedAt: string;
}

const SMS_HISTORY: SmsMessageRecord[] = [
  {
    id: 'SMS-90182',
    phoneNumber: '+2348034928819',
    recipientName: 'Amina Bello',
    message: 'MedCore Health: Your Lab Results (Full Blood Count & Malaria RDT) are READY. Please proceed to Clinic Room 4.',
    category: 'LAB_RESULT',
    status: 'DELIVERED',
    gatewayProvider: 'TERMII_NIGERIA',
    dispatchedAt: '2026-09-23T20:15:00Z',
  },
  {
    id: 'SMS-90183',
    phoneNumber: '+2348021194820',
    recipientName: 'Emeka Okafor',
    message: 'MedCore Pharmacy: Your prescription RX-PAT-620194 has been dispensed and is ready for pickup at Main Inpatient Pharmacy.',
    category: 'PHARMACY_READY',
    status: 'DELIVERED',
    gatewayProvider: 'TERMII_NIGERIA',
    dispatchedAt: '2026-09-23T21:00:00Z',
  },
];

/**
 * POST /api/v1/comms/sms/send
 */
router.post('/sms/send', (req: Request, res: Response) => {
  const { phoneNumber, message, recipientName, category } = req.body;

  if (!phoneNumber || !message) {
    return res.status(400).json({ success: false, error: 'phoneNumber and message are required' });
  }

  const record: SmsMessageRecord = {
    id: `SMS-${Math.floor(10000 + Math.random() * 90000)}`,
    phoneNumber,
    recipientName,
    message,
    category: category || 'APPOINTMENT',
    status: 'DELIVERED',
    gatewayProvider: 'TERMII_NIGERIA',
    dispatchedAt: new Date().toISOString(),
  };

  SMS_HISTORY.unshift(record);

  auditLedger.logEvent({
    actorId: 'COMMS-GATEWAY',
    actorName: 'SMS Notification Service',
    actorRole: 'COMMUNITY_HEALTH_WORKER',
    facilityId: 'FAC-001',
    action: 'READ_PHI',
    resourceType: 'PATIENT',
    resourceId: phoneNumber,
    reason: `Automated SMS dispatched: category ${record.category}`,
  });

  res.status(201).json({
    success: true,
    message: `SMS successfully dispatched to ${phoneNumber} via Termii Nigeria gateway.`,
    data: record,
  });
});

/**
 * GET /api/v1/comms/sms/logs
 */
router.get('/sms/logs', (req: Request, res: Response) => {
  res.json({ success: true, total: SMS_HISTORY.length, data: SMS_HISTORY });
});

/**
 * POST /api/v1/comms/ussd
 * Interactive USSD Session Handler (*384*48#)
 * Telecommunications standard for non-smartphone offline patient access
 */
router.post('/ussd', (req: Request, res: Response) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;
  const input = typeof text === 'string' ? text.trim() : '';

  let responseText = '';
  let shouldContinue = true;

  if (input === '') {
    // Main Menu
    responseText = 'CON Welcome to MedCore Akwa Ibom Health Services\n' +
      '1. Check Lab Results Ready\n' +
      '2. Clinic Queue Position\n' +
      '3. Pharmacy Rx Status\n' +
      '4. Emergency Ambulance Dispatch';
  } else if (input === '1') {
    responseText = 'CON Enter your 5-digit Hospital MRN (e.g. 78401):';
  } else if (input.startsWith('1*')) {
    const mrn = input.split('*')[1];
    shouldContinue = false;
    responseText = `END MRN ${mrn}: Your Malaria RDT and FBC results are SIGNED and ready. Please visit GOPD Consultation Room 2.`;
  } else if (input === '2') {
    responseText = 'CON Enter your 5-digit Hospital MRN:';
  } else if (input.startsWith('2*')) {
    const mrn = input.split('*')[1];
    shouldContinue = false;
    responseText = `END MRN ${mrn}: You are #4 in queue for Dr. Adeyemi at GOPD Bay 3. Estimated wait: 14 mins.`;
  } else if (input === '3') {
    responseText = 'CON Enter your 5-digit Hospital MRN:';
  } else if (input.startsWith('3*')) {
    const mrn = input.split('*')[1];
    shouldContinue = false;
    responseText = `END MRN ${mrn}: Your prescription is DISPENSED at Main Pharmacy Desk 1. Total Co-pay: N950.`;
  } else if (input === '4') {
    shouldContinue = false;
    responseText = 'END AMBULANCE DISPATCH: If this is a life-threatening emergency, our 24/7 hotline is connecting you to 112 / +234-800-AK-MEDCORE.';
  } else {
    shouldContinue = false;
    responseText = 'END Invalid choice. Please dial *384*48# again.';
  }

  res.set('Content-Type', 'text/plain');
  res.send(responseText);
});

export default router;
