import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  SOS: undefined;
  SOSForm: { onSaved?: () => void };
  Events: undefined;
  Invoices: undefined;
  InvoiceDetail: {
    invoiceId: string;
    invoice?: import('../api/billing').ResidentInvoice;
  };
  VendorsByCategory: { category: import('../constants/vendorCategories').VendorCategoryKey };
  ServiceDetails: { serviceId: string; title?: string };
};

export type ComplaintsStackParamList = {
  Complaints: undefined;
  ComplaintForm: {
    society_id?: string;
    apartment_id?: string;
    complaint?: { id: number; title: string; description?: string };
    onSaved?: () => void;
  };
};

export type VisitorsStackParamList = {
  Visitors: undefined;
  VisitorForm: { onSaved?: () => void };
};

export type PostsStackParamList = {
  Posts: undefined;
  PostForm: {
    onSaved?: () => void;
    post?: { id: number; title: string; description?: string; images?: string[] };
  };
};

export type ProfileStackParamList = {
  Profile: { startEditing?: boolean } | undefined;
  Maids: undefined;
  MaidDetails: { maid: import('../api/maid').Maid };
  ChatInbox: undefined;
  Chat: {
    chatId: string | number;
    vendorId?: string | number;
    vendorName?: string;
    vendorProfileImage?: string | null;
  };
};

export type NoticeStackParamList = {
  Notice: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ApproveDeny: {
    visitorName: string;
    requestId?: string;
    actionId?: string;
    phone?: string;
    flat?: string;
    vehicle?: string;
  };
  NotificationCheck: undefined;
  CreateTicket: { kind?: 'general' | 'bug' } | undefined;
  Settings: undefined;
};

export type AuthStackProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
export type HomeStackProps<T extends keyof HomeStackParamList> = NativeStackScreenProps<HomeStackParamList, T>;
export type ComplaintsStackProps<T extends keyof ComplaintsStackParamList> = NativeStackScreenProps<ComplaintsStackParamList, T>;
export type VisitorsStackProps<T extends keyof VisitorsStackParamList> = NativeStackScreenProps<VisitorsStackParamList, T>;
export type PostsStackProps<T extends keyof PostsStackParamList> = NativeStackScreenProps<PostsStackParamList, T>;
export type NoticeStackProps<T extends keyof NoticeStackParamList> = NativeStackScreenProps<NoticeStackParamList, T>;
