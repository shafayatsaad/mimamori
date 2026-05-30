'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { IntakeLog, calculateHydrationGoal, computeHydrationAggregates } from '../lib/hydration';
import { useFormatter } from 'next-intl';
import { DEFAULT_PERMISSIONS } from '../lib/permissions';
import { storageKey } from '../lib/storage-keys';
import { DEFAULT_CITY_PRESETS } from '../lib/city-presets';
import { fetchWithRetry } from '../lib/fetch-with-retry';

/** Dynamic permission type — no longer a hardcoded union. */
export type CaregiverPermission = string;

export interface LinkedPatient {
  email: string;
  name: string;
  caregiverId: string;
}

export interface Caregiver {
  id: string;
  name: string;
  selfName?: string;
  role: string;
  image: string;
  integration: string;
  permissions: CaregiverPermission[];
}

export interface PatientProfile {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  conditions: string[];
  allergies: string[];
  image?: string;
  targetBP?: string;
  targetWeight?: string;
  targetWeightUnit?: string;
}


export interface Invitation {
  code: string;
  name: string;
  role: string;
  permissions: CaregiverPermission[];
  email: string;
}

export interface MedicalDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  status: string;
  fileUrl?: string;
  analysis?: any;
}

export interface DailyLog {
  id: string;
  text: string;
  transcript?: string;
  date: string;
  probes: string[];
  probeAnswers?: { question: string; title: string; answer: string }[];
  entities?: any[];
}

export interface Appointment {
  id: string;
  type: string;
  doctor: string;
  dept: string;
  date: string;
  time: string;
  room: string;
  isUpcoming: boolean;
  notes: string;
  isHero?: boolean;
  status?: string;
  statusColor?: string;
}

export interface CustomNote {
  id: string;
  text: string;
  date: string;
}

export interface NotificationSetting {
  title: string;
  desc: string;
  active: boolean;
  /** Optional schedule — when present, the setting shows a day/time picker. */
  schedule?: {
    day?: string;   // e.g. "Sunday", "Daily"
    time?: string;  // e.g. "18:00"
  };
}

export interface UserSettings {
  notifications: NotificationSetting[];
}

export interface AIGeneration {
  content: string;
  generatedAt: string;
  triggerHash: string;
}

export interface AIGenerations {
  [key: string]: AIGeneration;
}

export const DEFAULT_SETTINGS: UserSettings = {
  notifications: [
    { title: 'Daily Reminders', desc: 'Get notified for checks, vitals, and pills.', active: true, schedule: { day: 'Daily', time: '09:00' } },
    { title: 'AI Predictive Alerts', desc: 'Alerts when unusual health patterns are detected.', active: true },
    { title: 'Weekly Summaries', desc: 'Receive a report every week.', active: false, schedule: { day: 'Sunday', time: '18:00' } }
  ]
};

interface AppContextType {
  patientEmail: string | null;
  currentUserType: 'Patient' | 'Caregiver' | null;
  currentCaregiverId: string | null;
  patientProfile: PatientProfile;
  updatePatientProfile: (updates: Partial<PatientProfile>) => void;
  login: (userData: { email: string; name: string; role: string }) => Promise<void>;
  loginAsPatient: () => void;
  loginAsCaregiver: (code: string, selfName?: string) => Promise<boolean>;
  logout: () => void;

  linkedPatients: LinkedPatient[];
  selectPatient: (email: string) => Promise<void>;

  invitations: Invitation[];
  generateInviteCode: (caregiverParams: Omit<Invitation, 'code'>) => string;

  caregivers: Caregiver[];
  addCaregiver: (caregiver: Omit<Caregiver, 'id'>) => void;
  removeCaregiver: (id: string) => void;
  updateCaregiver: (id: string, updates: Partial<Caregiver>) => void;
  documents: MedicalDocument[];
  addDocument: (doc: Omit<MedicalDocument, 'id' | 'date' | 'status'>) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<MedicalDocument>) => void;
  logs: DailyLog[];
  addLog: (text: string, probes: string[], entities?: any[], probeAnswers?: { question: string; title: string; answer: string }[]) => void;

  appointments: Appointment[];
  addAppointment: (appt: Omit<Appointment, 'id'>) => void;
  updateAppointment: (id: string, appt: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;

  customNotes: CustomNote[];
  addCustomNote: (text: string) => void;
  removeCustomNote: (id: string) => void;

  // Settings
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  toggleNotificationSetting: (index: number) => void;

  // AI generation persistence
  aiGenerations: AIGenerations;
  setAIGeneration: (type: string, content: string, triggerHash: string) => void;
  getGenerationTriggerHash: () => string;

  // Sync failure tracking
  syncFailed: boolean;
  alertCount: number;
  fetchAlerts: () => Promise<void>;

  // Hydration state
  intakeLogs: IntakeLog[];
  hydrationGoal: number;
  hydrationTemperature: number | null;
  hydrationLoading: boolean;
  addIntakeLog: (amount: number) => Promise<void>;
  correctIntakeTotal: (newTotal: number) => void;
  totalConsumed: number;
  locationError: boolean;
  fetchWeatherByLocation: (lat: number, lon: number) => Promise<void>;
  hydrationPresets: number[];
  intakeBounds: { min: number; max: number };
  cityPresets: { name: string; lat: number; lon: number }[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const format = useFormatter();

  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);

  const [documents, setDocuments] = useState<MedicalDocument[]>([]);

  const [logs, setLogs] = useState<DailyLog[]>([]);

  const [patientProfile, setPatientProfile] = useState<PatientProfile>({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    bloodType: '',
    conditions: [],
    allergies: []
  });

  const [currentUserType, setCurrentUserType] = useState<'Patient' | 'Caregiver' | null>(null);
  const [currentCaregiverId, setCurrentCaregiverId] = useState<string | null>(null);
  const [patientEmail, setPatientEmail] = useState<string | null>(null);
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatient[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customNotes, setCustomNotes] = useState<CustomNote[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isDbSynced, setIsDbSynced] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  // Hydration state
  const [intakeLogs, setIntakeLogs] = useState<IntakeLog[]>([]);
  const [hydrationGoal, setHydrationGoal] = useState<number>(2000);

  // AI generation persistence
  const [aiGenerations, setAiGenerations] = useState<AIGenerations>({});
  const [hydrationTemperature, setHydrationTemperature] = useState<number | null>(null);
  const [hydrationLoading, setHydrationLoading] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<boolean>(false);
  const [hydrationPresets, setHydrationPresets] = useState<number[]>([200, 350, 500]);
  const [intakeBounds, setIntakeBounds] = useState<{ min: number; max: number }>({ min: 50, max: 2000 });
  const [cityPresets, setCityPresets] = useState<{ name: string; lat: number; lon: number }[]>(DEFAULT_CITY_PRESETS);

  // Load from LocalStorage
  useEffect(() => {
    const savedCaregivers = localStorage.getItem(storageKey('caregivers'));
    const savedDocs = localStorage.getItem(storageKey('docs'));
    const savedLogs = localStorage.getItem(storageKey('logs'));
    const savedInvites = localStorage.getItem(storageKey('invites'));
    const savedProfile = localStorage.getItem(storageKey('profile'));
    const savedAppts = localStorage.getItem(storageKey('appointments'));
    const savedHydration = localStorage.getItem(storageKey('hydration_logs'));
    const savedSettings = localStorage.getItem(storageKey('settings'));
    const savedAiGenerations = localStorage.getItem(storageKey('ai_generations'));
    const savedCustomNotes = localStorage.getItem(storageKey('custom_notes'));

    if (savedCaregivers) setCaregivers(JSON.parse(savedCaregivers));
    if (savedDocs) setDocuments(JSON.parse(savedDocs));
    if (savedLogs) setLogs(JSON.parse(savedLogs));

    // Auth state is now in httpOnly cookies (Req 3.5) — verify session server-side
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          const type = data.user.role === 'caregiver' ? 'Caregiver' : 'Patient';
          setCurrentUserType(type as 'Patient' | 'Caregiver');
          setPatientEmail(data.user.email || null);

          // Trigger background sync to fetch latest DynamoDB state
          if (data.user.email) {
            fetch(`/api/sync?email=${encodeURIComponent(data.user.email)}`)
              .then(res => res.json())
              .then(syncData => {
                if (syncData.state) {
                  const st = syncData.state;
                  setCaregivers(st.caregivers || []);
                  setDocuments(st.documents || []);
                  setLogs(st.logs || []);
                  setInvitations(st.invitations || []);
                  if (st.profile && Object.keys(st.profile).length > 0) {
                    setPatientProfile(prev => ({ ...prev, ...st.profile }));
                  }
                  setAppointments(st.appointments || []);
                  if (st.customNotes) setCustomNotes(st.customNotes);
                  if (st.hydrationLogs) setIntakeLogs(st.hydrationLogs);
                  if (st.settings) setSettings(st.settings);
                  if (st.aiGenerations) setAiGenerations(st.aiGenerations);
                  setSyncFailed(false);
                }
                setIsDbSynced(true);
              })
              .catch(err => {
                console.error("Failed to sync initial state from DynamoDB", err);
                setSyncFailed(true);
                setIsDbSynced(true);
              });
          } else {
            setIsDbSynced(true);
          }
        } else {
          setIsDbSynced(true);
        }
      })
      .catch(err => {
        console.error("Failed to verify session", err);
        setIsDbSynced(true);
      });

    if (savedInvites) setInvitations(JSON.parse(savedInvites));
    if (savedProfile) setPatientProfile(JSON.parse(savedProfile));
    if (savedAppts) setAppointments(JSON.parse(savedAppts));
    if (savedCustomNotes) setCustomNotes(JSON.parse(savedCustomNotes));
    if (savedHydration) setIntakeLogs(JSON.parse(savedHydration));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedAiGenerations) setAiGenerations(JSON.parse(savedAiGenerations));

    const savedLinkedPatients = localStorage.getItem(storageKey('linked_patients'));
    if (savedLinkedPatients) setLinkedPatients(JSON.parse(savedLinkedPatients));

    setIsLoaded(true);
  }, []);

  // Initialize hydration data: fetch weather + today's intake logs
  useEffect(() => {
    if (!isLoaded || !patientEmail) {
      setHydrationLoading(false);
      return;
    }

    const initHydration = async () => {
      setHydrationLoading(true);
      let gotWeather = false;

      // Fetch hydration config (presets, bounds, city presets) from server
      try {
        const configRes = await fetch(`/api/hydration/config?email=${encodeURIComponent(patientEmail!)}`);
        const configData = await configRes.json();
        if (configRes.ok) {
          if (configData.presetsMl) setHydrationPresets(configData.presetsMl);
          if (configData.intakeMinMl != null && configData.intakeMaxMl != null) {
            setIntakeBounds({ min: configData.intakeMinMl, max: configData.intakeMaxMl });
          }
          if (configData.cityPresets) setCityPresets(configData.cityPresets);
        }
      } catch (_err) {
        // Config fetch failed — keep defaults
      }

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          const weatherRes = await fetch(`/api/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
          const weatherData = await weatherRes.json();
          if (weatherRes.ok && weatherData.temperature != null) {
            setHydrationTemperature(weatherData.temperature);
            setHydrationGoal(calculateHydrationGoal(weatherData.temperature));
            setLocationError(false);
            gotWeather = true;
          }
        } catch (_err) {
          // Geolocation denied or failed
        }
      }

      if (!gotWeather) {
        setLocationError(true);
      }

      try {
        const today = new Date().toISOString().slice(0, 10);
        const hydrationRes = await fetch(`/api/hydration?email=${encodeURIComponent(patientEmail)}&date=${today}`);
        const hydrationData = await hydrationRes.json();
        if (hydrationRes.ok && hydrationData.logs) {
          setIntakeLogs(hydrationData.logs);
        }
      } catch (err) {
        console.error('Failed to fetch hydration logs:', err);
      }

      setHydrationLoading(false);
    };

    initHydration();
  }, [isLoaded, patientEmail]);

  // Save to LocalStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(storageKey('caregivers'), JSON.stringify(caregivers));
      localStorage.setItem(storageKey('docs'), JSON.stringify(documents));
      localStorage.setItem(storageKey('logs'), JSON.stringify(logs));
      localStorage.setItem(storageKey('invites'), JSON.stringify(invitations));
      localStorage.setItem(storageKey('profile'), JSON.stringify(patientProfile));
      localStorage.setItem(storageKey('appointments'), JSON.stringify(appointments));
      localStorage.setItem(storageKey('hydration_logs'), JSON.stringify(intakeLogs));
      localStorage.setItem(storageKey('settings'), JSON.stringify(settings));
      localStorage.setItem(storageKey('ai_generations'), JSON.stringify(aiGenerations));
      localStorage.setItem(storageKey('linked_patients'), JSON.stringify(linkedPatients));
      localStorage.setItem(storageKey('custom_notes'), JSON.stringify(customNotes));

      // Background Sync to DynamoDB with retry (2 retries, 2s delay, no 4xx retry)
      if (patientEmail && isDbSynced) {
        const stateToSync = {
          caregivers, documents, logs, invitations, profile: patientProfile, appointments, hydrationLogs: intakeLogs, settings, aiGenerations, customNotes
        };
        fetchWithRetry(
          '/api/sync',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: patientEmail, state: stateToSync })
          },
          { maxRetries: 2, delayMs: 2000, retryOn4xx: false }
        )
          .then(res => {
            if (res.ok) {
              setSyncFailed(false);
            } else {
              setSyncFailed(true);
            }
          })
          .catch(err => {
            console.error("Failed to sync state to DynamoDB after retries", err);
            setSyncFailed(true);
          });
      }
    }
  }, [caregivers, documents, logs, currentUserType, currentCaregiverId, invitations, patientProfile, appointments, intakeLogs, settings, aiGenerations, linkedPatients, customNotes, isLoaded, patientEmail]);

  const login = async (userData: { email: string; name: string; role: string }) => {
    const type = userData.role === 'caregiver' ? 'Caregiver' : 'Patient';
    setCurrentUserType(type);
    setCurrentCaregiverId(null);
    setPatientEmail(userData.email);

    // Fetch the patient's existing DynamoDB state
    try {
      const res = await fetch(`/api/sync?email=${encodeURIComponent(userData.email)}`);
      const data = await res.json();
      
      if (res.ok && data.state) {
        const st = data.state;
        setCaregivers(st.caregivers || []);
        setDocuments(st.documents || []);
        setLogs(st.logs || []);
        setInvitations(st.invitations || []);
        setAppointments(st.appointments || []);
        if (st.customNotes) setCustomNotes(st.customNotes);
        if (st.hydrationLogs) setIntakeLogs(st.hydrationLogs);
        if (st.settings) setSettings(st.settings);
        if (st.aiGenerations) setAiGenerations(st.aiGenerations);
        const defaultProfile = {
          name: userData.name,
          email: userData.email,
          phone: '',
          dateOfBirth: '',
          gender: '',
          bloodType: '',
          conditions: [],
          allergies: []
        };
        setPatientProfile(st.profile && Object.keys(st.profile).length > 0 ? { ...defaultProfile, ...st.profile } : defaultProfile);
        setSyncFailed(false);
      } else {
        // Fallback for brand new users
        setPatientProfile({
          name: userData.name,
          email: userData.email,
          phone: '',
          dateOfBirth: '',
          gender: '',
          bloodType: '',
          conditions: [],
          allergies: []
        });
        setCaregivers([]);
        setDocuments([]);
        setLogs([]);
        setInvitations([]);
        setAppointments([]);
      }
    } catch (e) {
      console.error("Failed to load user state from DB", e);
      setSyncFailed(true);
    } finally {
      setIsDbSynced(true);
    }

    // Fetch unread alert count
    try {
      const alertRes = await fetch(`/api/alerts?email=${encodeURIComponent(userData.email)}`);
      const alertData = await alertRes.json();
      if (alertRes.ok && Array.isArray(alertData.alerts)) {
        setAlertCount(alertData.alerts.filter((a: any) => !a.read).length);
      }
    } catch (e) {
      console.error("Failed to fetch unread alerts", e);
    }
  };

  const loginAsPatient = () => {
    setCurrentUserType('Patient');
    setCurrentCaregiverId(null);
  };

  const loginAsCaregiver = async (code: string, selfName?: string) => {
    try {
      const res = await fetch('/api/caregiver/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, selfName })
      });
      const data = await res.json();

      if (res.ok && data.patientEmail) {
        setPatientEmail(data.patientEmail);
        setCurrentUserType('Caregiver');
        setCurrentCaregiverId(data.caregiverId);

        // Add to linked patients if not already there
        setLinkedPatients(prev => {
          if (prev.some(p => p.email === data.patientEmail)) return prev;
          return [...prev, { email: data.patientEmail, name: '', caregiverId: data.caregiverId }];
        });

        // Instantly sync patient data for this caregiver
        const syncRes = await fetch(`/api/sync?email=${encodeURIComponent(data.patientEmail)}`);
        const syncData = await syncRes.json();
        
        if (syncRes.ok && syncData.state) {
          const st = syncData.state;
          setCaregivers(st.caregivers || []);
          setDocuments(st.documents || []);
          setLogs(st.logs || []);
          setInvitations(st.invitations || []);
          setAppointments(st.appointments || []);
          if (st.customNotes) setCustomNotes(st.customNotes);
          if (st.hydrationLogs) setIntakeLogs(st.hydrationLogs);
          if (st.settings) setSettings(st.settings);
          if (st.aiGenerations) setAiGenerations(st.aiGenerations);
          if (st.profile && Object.keys(st.profile).length > 0) {
            setPatientProfile(st.profile);
            // Update linked patient name from profile
            setLinkedPatients(prev => prev.map(p => 
              p.email === data.patientEmail ? { ...p, name: st.profile.name || p.name } : p
            ));
          }
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to join as caregiver:', error);
    }
    return false;
  };

  const selectPatient = async (email: string) => {
    const linked = linkedPatients.find(p => p.email === email);
    if (!linked) return;

    setPatientEmail(email);
    setCurrentCaregiverId(linked.caregiverId);

    const syncRes = await fetch(`/api/sync?email=${encodeURIComponent(email)}`);
    const syncData = await syncRes.json();

    if (syncRes.ok && syncData.state) {
      const st = syncData.state;
      setCaregivers(st.caregivers || []);
      setDocuments(st.documents || []);
      setLogs(st.logs || []);
      setInvitations(st.invitations || []);
      setAppointments(st.appointments || []);
      if (st.customNotes) setCustomNotes(st.customNotes);
      if (st.hydrationLogs) setIntakeLogs(st.hydrationLogs);
      if (st.settings) setSettings(st.settings);
      if (st.aiGenerations) setAiGenerations(st.aiGenerations);
      if (st.profile && Object.keys(st.profile).length > 0) {
        setPatientProfile(st.profile);
        setLinkedPatients(prev => prev.map(p =>
          p.email === email ? { ...p, name: st.profile.name || p.name } : p
        ));
      }
    }
  };

  const logout = async () => {
    // Force a final sync to DynamoDB before clearing state
    if (patientEmail) {
      try {
        const stateToSync = {
          caregivers, documents, logs, invitations, profile: patientProfile, appointments, hydrationLogs: intakeLogs, settings, aiGenerations, customNotes
        };
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: patientEmail, state: stateToSync })
        });
      } catch (err) {
        console.error('Failed to sync before logout:', err);
      }
    }

    // Clear all state
    setCurrentUserType(null);
    setCurrentCaregiverId(null);
    setPatientEmail(null);
    setCaregivers([]);
    setDocuments([]);
    setLogs([]);
    setInvitations([]);
    setAppointments([]);
    setPatientProfile({ name: '', email: '', phone: '', dateOfBirth: '', gender: '', bloodType: '', conditions: [], allergies: [] });
    setIsDbSynced(false);
    setSyncFailed(false);
    setAlertCount(0);
    setIntakeLogs([]);
    setHydrationGoal(2000);
    setHydrationTemperature(null);
    setHydrationLoading(true);
    setLocationError(false);
    setSettings(DEFAULT_SETTINGS);
    setAiGenerations({});

    // Clear ALL LocalStorage keys to prevent cross-user data leaks
    localStorage.removeItem(storageKey('caregivers'));
    localStorage.removeItem(storageKey('docs'));
    localStorage.removeItem(storageKey('logs'));
    localStorage.removeItem(storageKey('invites'));
    localStorage.removeItem(storageKey('profile'));
    localStorage.removeItem(storageKey('appointments'));
    localStorage.removeItem(storageKey('hydration_logs'));
    localStorage.removeItem(storageKey('settings'));
    localStorage.removeItem(storageKey('ai_generations'));
  };

  const generateInviteCode = (params: Omit<Invitation, 'code'>) => {
    // Generate a secure-looking 6-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setInvitations(prev => [...prev, { ...params, code }]);
    return code;
  };

  const addCaregiver = (caregiver: Omit<Caregiver, 'id'>) => {
    setCaregivers(prev => [...prev, { ...caregiver, id: Date.now().toString() }]);
  };

  const removeCaregiver = (id: string) => {
    setCaregivers(prev => prev.filter(c => c.id !== id));
  };

  const updateCaregiver = (id: string, updates: Partial<Caregiver>) => {
    setCaregivers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addDocument = (doc: Omit<MedicalDocument, 'id' | 'date' | 'status'>) => {
    setDocuments(prev => [{
      ...doc,
      id: `doc-${Date.now()}`,
      date: format.dateTime(new Date(), { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Just Uploaded'
    }, ...prev]);
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const updateDocument = (id: string, updates: Partial<MedicalDocument>) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const addLog = (text: string, probes: string[], entities?: any[], probeAnswers?: { question: string; title: string; answer: string }[]) => {
    setLogs(prev => [{
      id: `log-${Date.now()}`,
      text,
      probes,
      probeAnswers,
      entities,
      date: format.dateTime(new Date(), { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }, ...prev]);
  };

  const updatePatientProfile = (updates: Partial<PatientProfile>) => {
    setPatientProfile(prev => ({ ...prev, ...updates }));
  };

  const updateSettings = (updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const toggleNotificationSetting = (index: number) => {
    setSettings(prev => {
      const newNotifications = [...prev.notifications];
      newNotifications[index] = { ...newNotifications[index], active: !newNotifications[index].active };
      return { ...prev, notifications: newNotifications };
    });
  };

  const setAIGeneration = (type: string, content: string, triggerHash: string) => {
    setAiGenerations(prev => ({
      ...prev,
      [type]: { content, generatedAt: new Date().toISOString(), triggerHash }
    }));
  };

  const getGenerationTriggerHash = (): string => {
    return `logs:${logs.length}|docs:${documents.length}|notes:${customNotes.length}`;
  };

  const addAppointment = (appt: Omit<Appointment, 'id'>) => {
    setAppointments(prev => [{ ...appt, id: Date.now().toString() }, ...prev]);
  };

  const updateAppointment = (id: string, appt: Partial<Appointment>) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...appt } : a));
  };

  const removeAppointment = (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const addCustomNote = (text: string) => {
    const note: CustomNote = { id: Date.now().toString(), text, date: new Date().toISOString() };
    setCustomNotes(prev => [note, ...prev]);
  };

  const removeCustomNote = (id: string) => {
    setCustomNotes(prev => prev.filter(n => n.id !== id));
  };

  const fetchWeatherByLocation = async (lat: number, lon: number): Promise<void> => {
    try {
      const weatherRes = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const weatherData = await weatherRes.json();
      if (weatherRes.ok && weatherData.temperature != null) {
        setHydrationTemperature(weatherData.temperature);
        setHydrationGoal(calculateHydrationGoal(weatherData.temperature));
        setLocationError(false);
      }
    } catch (err) {
      console.error('Failed to fetch weather by location:', err);
    }
  };

  const addIntakeLog = async (amount: number): Promise<void> => {
    const timestamp = new Date().toISOString();
    const date = timestamp.slice(0, 10); // YYYY-MM-DD
    const localId = `local-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
    const localLog: IntakeLog = {
      id: localId,
      amount,
      timestamp,
      date
    };

    // Optimistically update the UI/local state immediately (Req 33.3 fallback to localStorage)
    setIntakeLogs(prev => [...prev, localLog]);

    try {
      const res = await fetch('/api/hydration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail || 'demo@mimamori.ai', log: { amount, timestamp } })
      });
      const data = await res.json();
      if (res.ok && data.log) {
        // Swap out the local temporary entry with the confirmed database log
        setIntakeLogs(prev => prev.map(l => l.id === localId ? data.log : l));
      } else {
        console.warn('Server failed to record hydration log, retaining local/offline entry:', data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to sync hydration log with server, retaining local/offline entry:', err);
    }
  };

  /** Correct the total consumed by adding a local-only adjustment log entry. */
  const correctIntakeTotal = (newTotal: number) => {
    const currentTotal = computeHydrationAggregates(intakeLogs).totalConsumed;
    const delta = newTotal - currentTotal;
    if (delta === 0) return;
    const now = new Date();
    const correctionLog: IntakeLog = {
      id: `correction-${now.getTime()}`,
      amount: delta,
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
    };
    setIntakeLogs(prev => [...prev, correctionLog]);
  };

  const fetchAlerts = async (): Promise<void> => {
    if (!patientEmail) return;
    try {
      const res = await fetch(`/api/alerts?email=${encodeURIComponent(patientEmail)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.alerts)) {
        setAlertCount(data.alerts.filter((a: any) => !a.read).length);
      }
      // On non-ok response, retain previous alertCount (do not reset to zero)
    } catch (err) {
      // On fetch failure, retain previous alertCount (do not reset to zero)
      console.error('Failed to fetch alerts', err);
    }
  };

  const totalConsumed = useMemo(
    () => computeHydrationAggregates(intakeLogs).totalConsumed,
    [intakeLogs]
  );

  return (
    <AppContext.Provider value={{
      patientEmail,
      currentUserType, currentCaregiverId, patientProfile, updatePatientProfile, login, loginAsPatient, loginAsCaregiver, logout,
      linkedPatients, selectPatient,
      invitations, generateInviteCode,
      caregivers, addCaregiver, removeCaregiver, updateCaregiver,
      documents, addDocument, removeDocument, updateDocument,
      logs, addLog,
      appointments, addAppointment, updateAppointment, removeAppointment,
      customNotes, addCustomNote, removeCustomNote,
      syncFailed, alertCount, fetchAlerts,
      settings, updateSettings, toggleNotificationSetting,
      aiGenerations, setAIGeneration, getGenerationTriggerHash,
      intakeLogs, hydrationGoal, hydrationTemperature, hydrationLoading, addIntakeLog, correctIntakeTotal, totalConsumed, locationError, fetchWeatherByLocation, hydrationPresets, intakeBounds, cityPresets
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
