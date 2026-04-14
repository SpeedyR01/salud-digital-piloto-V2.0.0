import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  DoctorScreen: undefined;
  DoctorDashboard: { doctorData: any; cedula: string };
  OnboardingDocument: undefined;
  MainTabs: undefined;
  HomeServices: { patientData: any; cedula: string } | undefined;
  GeneralAppointment: undefined;
  SymptomReport: undefined;
  GeneralAppointmentConfirm: { slotLabel: string };
  SpecialistList: undefined;
  SpecialistAppointment: { specialization: string };
  SpecialistAppointmentConfirm: { specialization: string; slotLabel: string };
  ExamsList: undefined;
  ExamDetail: { examId: string };
  ExamResultViewer: { examId: string };
  MedicalHistory: undefined;
  MedicalHistoryDetail: { historyId: string };
  EmergencyFlow: undefined;
  PatientProfile: undefined;
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;
