export type UserRole = 'Editor' | 'Client';
export type SubscriptionPlan = 'Starter' | 'Professional' | 'Agency';
export type ProjectStatus = 'Pending' | 'Editing' | 'Revision' | 'Completed';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  subscription: SubscriptionPlan;
  createdAt: any; // Firestore Timestamp
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  editorId: string;
  editorEmail: string;
  editorName: string;
  videoUrl: string;
  videoName: string;
  subscriptionType: SubscriptionPlan;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  attachments?: Attachment[];
}

export interface Revision {
  id: string;
  projectId: string;
  comment: string;
  timestamp: string; // e.g. "01:15"
  userId: string;
  userName: string;
  userRole: UserRole;
  status: 'open' | 'resolved';
  createdAt: any; // Firestore Timestamp
}
