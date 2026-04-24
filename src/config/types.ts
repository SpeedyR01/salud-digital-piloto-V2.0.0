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
  GeneralAppointmentConfirm: { slotLabel: string; pacienteNombre?: string; doctorNombre?: string };
  SpecialistList: undefined;
  SpecialistAppointment: { specialization: string };
  SpecialistAppointmentConfirm: { specialization: string; slotLabel: string; pacienteNombre?: string; doctorNombre?: string };
  ExamsList: undefined;
  ExamDetail: { examId: string };
  ExamResultViewer: { examId: string };
  MedicalHistory: undefined;
  MedicalHistoryDetail: { historyId: string };
  EmergencyFlow: undefined;
  PatientProfile: undefined;
  DoctorCitaDetail: {
    citaId: string;
    pacienteNombre: string;
    pacienteDoc: string;
    especialidad: string;
    fecha: string;
    hora: string;
    modalidad: string;
    estado: string;
  };
  DoctorProfile: undefined;
  MisCitas: undefined;
  TelemedicineCall: { citaId: string; pacienteNombre: string; role: 'doctor' | 'patient' };
  DoctorPostCall: { citaId: string; pacienteNombre: string };
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;
