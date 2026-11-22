'use client';

import React, { useCallback } from 'react';
import {
  FaceLivenessDetectorCore,
  type AwsCredentialProvider,
} from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react/styles.css';

interface LiveFaceLivenessDetectorProps {
  sessionId: string;
  region: string;
  livenessToken: string;
  onAnalysisComplete: () => Promise<void>;
  onFallback: (reason?: string) => void;
}

/**
 * Live 3D camera anti-spoofing streaming detector powered by AWS Amplify UI Liveness
 * without Cognito (uses short-lived scoped STS credentials via /api/auth/biometric/liveness/session).
 */
export const LiveFaceLivenessDetector: React.FC<LiveFaceLivenessDetectorProps> = ({
  sessionId,
  region,
  livenessToken,
  onAnalysisComplete,
  onFallback,
}) => {
  const credentialProvider: AwsCredentialProvider = useCallback(async () => {
    const res = await fetch(
      `/api/auth/biometric/liveness/session?livenessToken=${encodeURIComponent(livenessToken)}`,
      { cache: 'no-store' }
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      accessKeyId?: string;
      secretAccessKey?: string;
      sessionToken?: string;
      expiration?: string;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.accessKeyId || !json.secretAccessKey || !json.sessionToken) {
      throw new Error(json.error || 'Could not obtain live verification session credentials.');
    }
    return {
      accessKeyId: json.accessKeyId,
      secretAccessKey: json.secretAccessKey,
      sessionToken: json.sessionToken,
      expiration: json.expiration ? new Date(json.expiration) : undefined,
    };
  }, [livenessToken]);

  return (
    <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden' }}>
      <FaceLivenessDetectorCore
        sessionId={sessionId}
        region={region}
        disableStartScreen={true}
        config={{ credentialProvider }}
        displayText={{
          hintCenterFaceText: 'Center your face inside the oval',
          hintTooFarText: 'Move closer',
          hintTooCloseText: 'Move farther away',
          hintHoldFaceForFreshnessText: 'Hold still…',
          goodFitCaptionText: 'Good fit',
          tooFarCaptionText: 'Too far',
          photosensitivityWarningHeadingText: 'Lighting Check Notice',
          photosensitivityWarningBodyText:
            'This live identity check briefly flashes neutral colors on your screen to confirm camera authenticity.',
        }}
        onAnalysisComplete={onAnalysisComplete}
        onError={(err) => {
          const msg =
            (err as { error?: { message?: string }; state?: string } | undefined)?.error?.message ||
            'Live camera stream unavailable — switching to hands-free scanner.';
          onFallback(msg);
        }}
      />
    </div>
  );
};

export default LiveFaceLivenessDetector;
