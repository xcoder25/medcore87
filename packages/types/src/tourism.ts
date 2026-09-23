export interface MedicalTourismRequest {
  id: string;
  patientId: string;
  originCountry: string;
  targetFacilityId: string;
  travelDetails: {
    arrivalFlightNumber?: string;
    arrivalDate?: string;
    departureFlightNumber?: string;
    departureDate?: string;
    airline?: string;
  };
  accommodation: {
    hotelPartnerName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    roomType?: string;
    specialNeeds?: string[];
  };
  interpreterServices: {
    required: boolean;
    sourceLanguage: string;
    targetLanguage: string;
    assignedInterpreterName?: string;
  };
  conciergeNotes: string;
  status: 'planning' | 'confirmed' | 'in_transit' | 'active_treatment' | 'repatriated';
}
