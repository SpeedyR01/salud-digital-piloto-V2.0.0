import React, { createContext, useContext } from 'react';

export type DocType = 'CC' | 'CE' | 'Pasaporte' | 'TI' | 'PAS';

export type PatientProfile = {
  name: string;
  docType: DocType;
  docNumber: string;
  role: 'especialistas' | 'pacientes';
};

export type PatientContextValue = {
  profile: PatientProfile | null;
  setProfile: (p: PatientProfile) => void;
  clearProfile: () => void;
};

export const PatientContext = createContext<PatientContextValue | null>(null);

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error('PatientContext missing');
  return ctx;
}
