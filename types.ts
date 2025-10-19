
export interface UserProfile {
  uid: string;
  name: string;
  handle: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  bio?: string;
  birthday?: string;
  chats?: Record<string, boolean>;
  privacy?: {
    showPhoneNumber?: 'everyone' | 'none';
  };
}

export interface Message {
  id: string;
  text?: string;
  imageUrl?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: number;
  unreadCount?: number;
}

// Fix: Define a specific type for the last message summary, which doesn't have an ID.
export interface LastMessage {
    text?: string;
    imageUrl?: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    timestamp: number;
}

export interface Chat {
  id: string;
  type: 'dm' | 'group' | 'channel';
  name: string;
  handle?: string; // for groups/channels
  avatarUrl?: string;
  // Fix: Use the correct LastMessage type for the lastMessage property, as the object in the database lacks an 'id'.
  lastMessage?: LastMessage;
  members: Record<string, boolean>; // all participants
  description?: string;
  isPublic?: boolean; // for groups/channels
  ownerId?: string; // for groups/channels
  admins?: Record<string, boolean>; // for groups/channels
  unreadCounts?: Record<string, number>;
}