
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { ref, set, get, onValue, push, serverTimestamp, query, orderByChild, limitToLast, remove, update, equalTo } from 'firebase/database';
import type { UserProfile, Message, Chat, LastMessage } from './types';
import { SearchIcon, PlusIcon, SendIcon, UsersIcon, HashtagIcon, PaperclipIcon, LogoutIcon, CloseIcon, ArrowLeftIcon, EllipsisVerticalIcon, PencilIcon, UserPlusIcon, MenuIcon, MoonIcon, SunIcon, UserCircleIcon as ProfileIcon, UserGroupIcon, PhoneIcon, BookmarkIcon, CogIcon, InfoCircleIcon, CheckIcon, CameraIcon, LockClosedIcon, BellIcon, CircleStackIcon, Battery50Icon, FolderIcon, ComputerDesktopIcon, LanguageIcon, StarIcon, PencilSquareIcon, ChatBubbleOvalLeftEllipsisIcon, ChevronRightIcon } from './components/Icons';

// --- CONSTANTS ---
const IMGBB_API_KEY = "5fd2a4346ac2e5485a916a5d734d508b";

// --- HELPER FUNCTIONS ---
const uploadImage = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('image', file);
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (data.success) {
            return data.data.url;
        }
        console.error("ImgBB upload failed:", data);
        return null;
    } catch (error) {
        console.error("Image upload failed:", error);
        return null;
    }
};

const formatTimestamp = (timestamp: number) => {
    if(!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fuzzySearch = (term: string, items: any[], keys: string[]): any[] => {
    if (!term) return [];
    const lowerTerm = term.toLowerCase();

    const scoredItems = items.map(item => {
        let score = 0;
        keys.forEach(key => {
            const value = item[key]?.toLowerCase();
            if (!value) return;

            if (value === lowerTerm) score += 100;
            else if (value.startsWith(lowerTerm)) score += 50;
            else if (value.includes(lowerTerm)) score += 20;
        });
        return { ...item, score };
    });

    return scoredItems.filter(item => item.score > 0).sort((a, b) => b.score - a.score);
};

type MenuItemDef = {
    icon: React.ElementType;
    text: string;
    action: () => void;
};


// --- UI COMPONENTS ---

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center h-full w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
    </div>
);

const Avatar: React.FC<{ src?: string; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' }> = ({ src, name, size = 'md' }) => {
    const sizeClasses = {
        sm: 'h-8 w-8',
        md: 'h-12 w-12',
        lg: 'h-16 w-16',
        xl: 'h-24 w-24',
        xxl: 'h-32 w-32',
    };
    const placeholder = name?.charAt(0).toUpperCase() || '?';
    return (
        <div className={`rounded-full flex items-center justify-center bg-blue-500 text-white font-semibold ${sizeClasses[size]} flex-shrink-0`}>
            {src ? <img src={src} alt={name} className="rounded-full h-full w-full object-cover" /> : <span>{placeholder}</span>}
        </div>
    );
};

const ListItem: React.FC<{icon: React.ElementType, text: string, value?: string, onClick?: () => void, last?: boolean}> = ({ icon: Icon, text, value, onClick, last }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-5 px-4 py-3 text-left hover:bg-gray-700/50 transition-colors ${!last && 'border-b border-gray-700/50'}`}>
        <Icon className="w-6 h-6 text-gray-400" />
        <span className="flex-1 text-white">{text}</span>
        {value && <span className="text-gray-400">{value}</span>}
        {onClick && <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
    </button>
);

const InfoItem: React.FC<{label: string, value: string, last?: boolean, onClick?: () => void}> = ({label, value, last, onClick}) => (
    <div onClick={onClick} className={`px-4 py-3 ${!last && 'border-b border-gray-700/50'} ${onClick && 'cursor-pointer'}`}>
        <p className="text-white">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
    </div>
);

const DateSeparator: React.FC<{ date: string }> = ({ date }) => (
    <div className="flex justify-center my-4">
        <span className="bg-gray-900/80 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {date}
        </span>
    </div>
);


// --- AUTH COMPONENTS ---
const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [phone, setPhone] = useState('');

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if(password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }
        setLoading(true);
        setError('');
        try {
            const handleRef = ref(db, `handles/${handle.toLowerCase()}`);
            const handleSnapshot = await get(handleRef);
            if (handleSnapshot.exists()) {
                throw new Error("Handle is already taken.");
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userProfile: UserProfile = { uid: user.uid, name, handle, email, phone, avatarUrl: `https://i.pravatar.cc/150?u=${user.uid}`, privacy: { showPhoneNumber: 'none' } };
            await set(ref(db, `users/${user.uid}`), userProfile);
            await set(ref(db, `handles/${handle.toLowerCase()}`), {type: 'user', id: user.uid});
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-xl border border-gray-700">
                <h2 className="text-3xl font-bold text-center text-white">{isLogin ? 'Welcome Back!' : 'Create Account'}</h2>
                {error && <p className="text-red-400 text-center bg-red-900/50 p-3 rounded-lg">{error}</p>}
                <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
                    {!isLogin && (
                        <>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                            <input type="text" value={handle} onChange={e => setHandle(e.target.value.toLowerCase())} placeholder="Handle (e.g., username)" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone Number" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                        </>
                    )}
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                    <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition-colors disabled:bg-gray-500 flex items-center justify-center">
                        {loading ? <Spinner /> : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                </form>
                <p className="text-center text-sm text-gray-400">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => { setIsLogin(!isLogin); setError('') }} className="font-semibold text-blue-500 hover:text-blue-400 ml-1">
                        {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
};

// --- DASHBOARD COMPONENTS ---
const DashboardPage: React.FC<{ user: User, userProfile: UserProfile }> = ({ user, userProfile }) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [loadingChats, setLoadingChats] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const [activeOverlay, setActiveOverlay] = useState<'none' | 'settings' | 'entityInfo'>('none');
    const [entityInfoChat, setEntityInfoChat] = useState<Chat | null>(null);

    useEffect(() => {
        const userChatsRef = ref(db, `users/${user.uid}/chats`);
        let lastMessageUnsubs: (() => void)[] = [];

        const unsubscribe = onValue(userChatsRef, (snapshot) => {
            lastMessageUnsubs.forEach(unsub => unsub());
            lastMessageUnsubs = [];

            setLoadingChats(true);
            if (snapshot.exists()) {
                const chatIds = Object.keys(snapshot.val());
                const chatPromises = chatIds.map(chatId => get(ref(db, `chats/${chatId}`)));
                
                Promise.all(chatPromises).then(chatSnapshots => {
                    const fetchedChats = chatSnapshots
                        .map(snap => snap.exists() ? ({ id: snap.key!, ...snap.val() } as Chat) : null)
                        .filter((c): c is Chat => c !== null);
                    
                    setChats(fetchedChats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)));

                    fetchedChats.forEach(chat => {
                        const lastMessageRef = ref(db, `chats/${chat.id}/lastMessage`);
                        const unsub = onValue(lastMessageRef, (msgSnap) => {
                           setChats(prev => {
                               const chatIndex = prev.findIndex(c => c.id === chat.id);
                               if (chatIndex === -1) return prev; 

                               const newChats = [...prev];
                               // Fix: Handle null from Firebase by casting and using nullish coalescing to convert to undefined.
                               // This resolves a potential type mismatch that can lead to the 'never' type error.
                               const lastMessage = msgSnap.val() as LastMessage | null;
                               newChats[chatIndex] = { ...newChats[chatIndex], lastMessage: lastMessage ?? undefined };
                               return newChats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
                           });
                        });
                        lastMessageUnsubs.push(unsub);
                    });
                    
                    setLoadingChats(false);
                }).catch(error => {
                    console.error("Failed to fetch chats", error);
                    setLoadingChats(false);
                });
            } else {
                setChats([]);
                setLoadingChats(false);
            }
        });
        return () => {
            unsubscribe();
            lastMessageUnsubs.forEach(unsub => unsub());
        };
    }, [user.uid]);

    const openEntityInfo = (chat: Chat) => {
        setEntityInfoChat(chat);
        setActiveOverlay('entityInfo');
    };

    return (
         <div className="h-screen w-screen flex bg-gray-900 text-gray-200 overflow-hidden relative">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} userProfile={userProfile} onSettingsClick={() => setActiveOverlay('settings')}/>
            <div className={`flex-1 flex transition-transform duration-300 ${isSidebarOpen ? 'translate-x-64' : 'translate-x-0'}`}>
                <div className={`h-full transition-all duration-300 ${activeChat ? 'w-0 -translate-x-full md:w-96 md:translate-x-0' : 'w-full md:w-96'}`}>
                    <ChatList userProfile={userProfile} chats={chats} setActiveChat={setActiveChat} activeChatId={activeChat?.id} loading={loadingChats} onMenuClick={() => setIsSidebarOpen(true)} />
                </div>
                <main className="flex-1 flex flex-col h-full bg-gray-800 bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-center bg-cover">
                    {activeChat ? (
                        <ChatWindow chat={activeChat} currentUser={userProfile} key={activeChat.id} onBack={() => setActiveChat(null)} onHeaderClick={() => openEntityInfo(activeChat)} />
                    ) : (
                        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-400 bg-gray-800/80">
                           <ChatBubbleOvalLeftEllipsisIcon className="w-24 h-24 text-gray-500 mb-4"/>
                            <h2 className="text-2xl font-semibold text-gray-200">BATCHAT</h2>
                            <p>Select a chat or start a new conversation</p>
                        </div>
                    )}
                </main>
            </div>
            {activeOverlay === 'settings' && <SettingsPage userProfile={userProfile} onClose={() => setActiveOverlay('none')} />}
            {activeOverlay === 'entityInfo' && entityInfoChat && <EntityInfoPage key={entityInfoChat.id} chat={entityInfoChat} currentUser={userProfile} onClose={() => setActiveOverlay('none')} />}
        </div>
    );
};

const ChatList: React.FC<{ userProfile: UserProfile; chats: Chat[]; setActiveChat: (chat: Chat) => void; activeChatId?: string; loading: boolean; onMenuClick: () => void; }> = ({ userProfile, chats, setActiveChat, activeChatId, loading, onMenuClick }) => {
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    return (
        <>
            <aside className="w-full h-full bg-gray-900 flex flex-col border-r border-gray-700/50">
                <header className="flex items-center gap-4 p-3 shadow-md bg-gray-800 z-10">
                    <button onClick={onMenuClick} className="text-gray-300 hover:text-white"><MenuIcon className="h-6 w-6" /></button>
                     <div className="relative flex-1">
                        <input onClick={() => setIsSearchModalOpen(true)} type="text" placeholder="Search" readOnly className="w-full bg-gray-700 text-gray-300 rounded-full py-2 pl-10 pr-4 focus:outline-none cursor-pointer" />
                         <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto">
                    {loading ? <div className="pt-8"><Spinner /></div> : chats.map(chat => (
                        <ChatListItem key={chat.id} chat={chat} onClick={() => setActiveChat(chat)} isActive={activeChatId === chat.id} currentUserId={userProfile.uid} />
                    ))}
                </div>
                 <button onClick={() => setIsCreateModalOpen(true)} className="absolute bottom-6 right-6 h-14 w-14 bg-blue-500 rounded-full shadow-lg text-white flex items-center justify-center hover:bg-blue-600 transition-colors">
                    <PencilIcon className="h-7 w-7" />
                </button>
            </aside>
            {isSearchModalOpen && <SearchModal userProfile={userProfile} onClose={() => setIsSearchModalOpen(false)} setActiveChat={setActiveChat} />}
            {isCreateModalOpen && <CreateModal userProfile={userProfile} onClose={() => setIsCreateModalOpen(false)} setActiveChat={setActiveChat} />}
        </>
    );
};

const ChatListItem: React.FC<{ chat: Chat; onClick: () => void; isActive: boolean; currentUserId: string; }> = ({ chat, onClick, isActive, currentUserId }) => {
    
    const [displayInfo, setDisplayInfo] = useState<{name: string, avatarUrl?: string}>({name: 'Loading...', avatarUrl: ''});
    const unreadCount = chat.unreadCounts?.[currentUserId] || 0;
    const wasSentByMe = chat.lastMessage?.senderId === currentUserId;

    useEffect(() => {
        let isMounted = true;
        let unsubscribe: (() => void) | null = null;
    
        if (chat.type === 'dm') {
            const otherUserId = Object.keys(chat.members || {}).find(id => id !== currentUserId);
            if (otherUserId) {
                const userRef = ref(db, `users/${otherUserId}`);
                unsubscribe = onValue(userRef, snapshot => {
                    if (snapshot.exists() && isMounted) {
                        const userData = snapshot.val() as UserProfile;
                        setDisplayInfo({name: userData.name, avatarUrl: userData.avatarUrl});
                    }
                });
            }
        } else {
            setDisplayInfo({name: chat.name, avatarUrl: chat.avatarUrl});
        }
    
        return () => {
            isMounted = false;
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [chat, currentUserId]);


    return (
        <div onClick={onClick} className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-gray-800 ${isActive ? 'bg-blue-600/50' : 'hover:bg-gray-800'}`}>
            <Avatar src={displayInfo.avatarUrl} name={displayInfo.name} />
            <div className="flex-1 truncate">
                <p className={`font-semibold ${isActive ? 'text-white' : 'text-gray-200'}`}>{displayInfo.name}</p>
                <p className={`text-sm truncate ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{chat.lastMessage?.imageUrl ? '📷 Image' : (chat.lastMessage?.text || 'No messages yet')}</p>
            </div>
             <div className="flex flex-col items-end gap-1 self-start">
                 {chat.lastMessage && <p className={`text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>{formatTimestamp(chat.lastMessage.timestamp)}</p>}
                 <div className="flex items-center gap-1">
                    {wasSentByMe && <CheckIcon className="h-4 w-4 text-blue-400" />}
                    {unreadCount > 0 && <span className="text-xs font-bold bg-blue-500 text-white rounded-full h-5 w-5 flex items-center justify-center">{unreadCount}</span>}
                 </div>
             </div>
        </div>
    );
};

const ChatWindow: React.FC<{ chat: Chat; currentUser: UserProfile; onBack: () => void; onHeaderClick: () => void; }> = ({ chat, currentUser, onBack, onHeaderClick }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatInfo, setChatInfo] = useState<{name: string, avatarUrl?: string, description?: string}>({ name: '', description: '' });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const canSendMessage = chat.type !== 'channel' || (chat.admins && chat.admins[currentUser.uid]) || chat.ownerId === currentUser.uid;

    useEffect(() => {
        let isMounted = true;
        if (chat.type === 'dm') {
            const otherUserId = Object.keys(chat.members || {}).find(id => id !== currentUser.uid);
            if (otherUserId) {
                get(ref(db, `users/${otherUserId}`)).then(snap => {
                    if(snap.exists() && isMounted){
                        const otherUser = snap.val() as UserProfile;
                        setChatInfo({ name: otherUser.name, avatarUrl: otherUser.avatarUrl, description: `last seen recently` }); 
                    }
                });
            }
        } else {
            setChatInfo({ name: chat.name, avatarUrl: chat.avatarUrl, description: `${Object.keys(chat.members).length} members` });
        }
        
        const messagesRef = query(ref(db, `chats/${chat.id}/messages`), orderByChild('timestamp'));
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const messagesData: Message[] = [];
            snapshot.forEach((childSnapshot) => {
                messagesData.push({ id: childSnapshot.key!, ...childSnapshot.val() });
            });
            if(isMounted) setMessages(messagesData);
        });
        return () => {
            isMounted = false;
            unsubscribe();
        }
    }, [chat, currentUser.uid]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    const handleSendMessage = (text?: string, imageUrl?: string) => {
        if (!text && !imageUrl) return;

        const messagesRef = ref(db, `chats/${chat.id}/messages`);
        const newMessageRef = push(messagesRef);
        
        const messageData: Partial<Omit<Message, 'id'>> & { senderId: string; senderName: string; timestamp: object } = {
            senderId: currentUser.uid,
            senderName: currentUser.name,
            senderAvatar: currentUser.avatarUrl,
            timestamp: serverTimestamp(),
        };

        if (text) messageData.text = text;
        if (imageUrl) messageData.imageUrl = imageUrl;
        
        set(newMessageRef, messageData);

        const lastMessageData: LastMessage = {
            senderId: currentUser.uid,
            senderName: currentUser.name,
            senderAvatar: currentUser.avatarUrl,
            timestamp: Date.now(),
            text: text || '📷 Image',
        };
        
        update(ref(db, `chats/${chat.id}`), { lastMessage: lastMessageData });
    };
    
    const messagesWithDates = useMemo(() => {
        const result: (Message | { type: 'date'; date: string })[] = [];
        let lastDate: string | null = null;
        messages.forEach(msg => {
            if(!msg.timestamp) return;
            const messageDate = new Date(msg.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            if (messageDate !== lastDate) {
                result.push({ type: 'date', date: new Date(msg.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) });
                lastDate = messageDate;
            }
            result.push(msg);
        });
        return result;
    }, [messages]);


    return (
        <div className="flex-1 flex flex-col h-full bg-gray-800/95">
            <header onClick={onHeaderClick} className="p-3 bg-gray-800/80 flex items-center gap-3 border-b border-gray-700 flex-shrink-0 cursor-pointer">
                 <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="md:hidden p-1 -ml-2 text-gray-300 hover:text-white">
                    <ArrowLeftIcon className="w-6 h-6" />
                 </button>
                 <Avatar src={chatInfo.avatarUrl} name={chatInfo.name} />
                 <div className="flex-1">
                    <h3 className="font-bold text-lg text-white">{chatInfo.name}</h3>
                    {chatInfo.description && <p className="text-sm text-blue-400">{chatInfo.description}</p>}
                 </div>
                 <button className="p-2 text-gray-300 hover:text-white">
                    <EllipsisVerticalIcon className="w-6 h-6" />
                </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center h-full">
                        <div className="bg-gray-900/80 p-6 rounded-lg text-center shadow-lg max-w-sm">
                            <h3 className="text-white font-semibold text-lg mb-2">No messages here yet...</h3>
                            <p className="text-gray-400 text-sm">Send a message or tap the greeting below.</p>
                        </div>
                    </div>
                )}
                {messagesWithDates.map((item, index) => {
                    if ('type' in item && item.type === 'date') {
                        return <DateSeparator key={item.date} date={item.date} />;
                    }
                    const msg = item as Message;
                    return <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === currentUser.uid} isGroup={chat.type !== 'dm'} />;
                })}
                <div ref={messagesEndRef} />
            </div>
            { canSendMessage ? <MessageInput onSend={handleSendMessage} /> : 
                <div className="p-4 bg-gray-800/80 border-t border-gray-700 text-center text-gray-400 text-sm">
                    You cannot send messages in this channel.
                </div>
            }
        </div>
    );
};

const MessageBubble: React.FC<{ message: Message; isOwn: boolean; isGroup: boolean; }> = ({ message, isOwn, isGroup }) => (
    <div className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        {!isOwn && isGroup && <Avatar src={message.senderAvatar} name={message.senderName} size="sm" />}
        <div className={`max-w-md p-3 rounded-xl shadow-md ${isOwn ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
             {!isOwn && isGroup && <p className="text-xs font-bold text-blue-400 mb-1">{message.senderName}</p>}
            {message.imageUrl && <img src={message.imageUrl} alt="uploaded content" className="rounded-lg mb-2 max-h-60" />}
            {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
            <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-500'} text-right`}>{formatTimestamp(message.timestamp)}</p>
        </div>
    </div>
);

const MessageInput: React.FC<{ onSend: (text?: string, imageUrl?: string) => void }> = ({ onSend }) => {
    const [text, setText] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleSend = () => {
        if (text.trim()) {
            onSend(text.trim());
            setText('');
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            const imageUrl = await uploadImage(file);
            if(imageUrl) {
                onSend(undefined, imageUrl);
            } else {
                alert("Image upload failed. Please try again.");
            }
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    
    return (
        <div className="p-3 bg-gray-800/80 border-t border-gray-700 flex-shrink-0">
            <div className="bg-gray-700 rounded-lg flex items-center p-1">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-200" disabled={isUploading}>
                    {isUploading ? <div className="h-6 w-6"><Spinner /></div> : <PaperclipIcon className="h-6 w-6" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <textarea
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    placeholder="Message"
                    className="flex-1 bg-transparent px-2 focus:outline-none text-gray-200 resize-none max-h-24"
                />
                <button onClick={handleSend} className="p-2 text-blue-500 hover:text-blue-400 disabled:text-gray-500" disabled={!text.trim()}>
                    <SendIcon className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
};

const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void; userProfile: UserProfile, onSettingsClick: () => void; }> = ({ isOpen, onClose, userProfile, onSettingsClick }) => {

    const menuItems: MenuItemDef[] = [
        { icon: UserGroupIcon, text: 'New Group', action: () => {} },
        { icon: UsersIcon, text: 'Contacts', action: () => {} },
        { icon: PhoneIcon, text: 'Calls', action: () => {} },
        { icon: BookmarkIcon, text: 'Saved Messages', action: () => {} },
        { icon: CogIcon, text: 'Settings', action: onSettingsClick },
    ];

    const lowerMenuItems: MenuItemDef[] = [
        { icon: UserPlusIcon, text: 'Invite Friends', action: () => {} },
        { icon: InfoCircleIcon, text: 'BATCHAT Features', action: () => {} },
    ];

    const toggleTheme = () => {
        document.documentElement.classList.toggle('dark');
    };

    return (
        <>
            <div className={`fixed top-0 left-0 h-full w-64 bg-gray-800 z-40 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <header className="p-4 bg-blue-600">
                    <div className="flex justify-between items-start">
                        <Avatar src={userProfile.avatarUrl} name={userProfile.name} size="md"/>
                        <button onClick={toggleTheme} className="text-blue-200 hover:text-white">
                            <MoonIcon className="h-6 w-6 hidden dark:block" />
                            <SunIcon className="h-6 w-6 dark:hidden" />
                        </button>
                    </div>
                    <p className="font-bold text-white mt-3">{userProfile.name}</p>
                    <p className="text-sm text-blue-200">{userProfile.phone}</p>
                </header>
                <nav className="p-2 space-y-1">
                    <button onClick={() => { onSettingsClick(); onClose(); }} className="w-full flex items-center gap-4 p-2 rounded-md hover:bg-gray-700">
                        <ProfileIcon className="w-6 h-6 text-gray-400"/>
                        <span className="font-medium text-gray-200">My Profile</span>
                    </button>
                    <hr className="border-gray-700 my-2" />
                    {menuItems.map(item => (
                        <button key={item.text} onClick={() => { item.action(); onClose(); }} className="w-full flex items-center gap-4 p-2 rounded-md hover:bg-gray-700">
                            <item.icon className="w-6 h-6 text-gray-400"/>
                            <span className="font-medium text-gray-200">{item.text}</span>
                        </button>
                    ))}
                    <hr className="border-gray-700 my-2" />
                    {lowerMenuItems.map(item => (
                         <button key={item.text} onClick={item.action} className="w-full flex items-center gap-4 p-2 rounded-md hover:bg-gray-700">
                            <item.icon className="w-6 h-6 text-gray-400"/>
                            <span className="font-medium text-gray-200">{item.text}</span>
                        </button>
                    ))}
                </nav>
            </div>
            {isOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose}></div>}
        </>
    );
};

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const userRef = ref(db, `users/${currentUser.uid}`);
                const unsubProfile = onValue(userRef, (snapshot) => {
                    if (snapshot.exists()) {
                        setUserProfile(snapshot.val());
                        setUser(currentUser);
                    } else {
                        signOut(auth);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error(error);
                    setLoading(false);
                });
                return () => unsubProfile();
            } else {
                setUser(null);
                setUserProfile(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
                <Spinner />
            </div>
        );
    }

    return user && userProfile ? <DashboardPage user={user} userProfile={userProfile} /> : <AuthPage />;
};


const CreateModal: React.FC<{ userProfile: UserProfile; onClose: () => void; setActiveChat: (chat: Chat) => void }> = ({ userProfile, onClose, setActiveChat }) => {
    const [step, setStep] = useState(1); // 1: choose type, 2: details, 3: add members
    const [type, setType] = useState<'group' | 'channel'>('group');
    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({ [userProfile.uid]: true });
    const [memberSearch, setMemberSearch] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (step === 3) {
            setLoading(true);
            const fetchUsers = async () => {
                const usersRef = ref(db, 'users');
                const usersSnap = await get(usersRef);
                const users: UserProfile[] = [];
                if (usersSnap.exists()) {
                    usersSnap.forEach(child => {
                        if (child.key !== userProfile.uid) {
                            users.push({ uid: child.key!, ...child.val() });
                        }
                    });
                }
                setAllUsers(users);
                setLoading(false);
            };
            fetchUsers();
        }
    }, [step, userProfile.uid]);

    const handleCreate = async () => {
        setLoading(true);
        setError('');
        try {
            if (handle) {
                const handleRef = ref(db, `handles/${handle.toLowerCase()}`);
                const handleSnapshot = await get(handleRef);
                if (handleSnapshot.exists()) {
                    throw new Error("Handle is already taken.");
                }
            }

            const newChatRef = push(ref(db, 'chats'));
            const chatId = newChatRef.key!;

            const newChatData: Chat = {
                id: chatId,
                type,
                name,
                handle: handle.toLowerCase(),
                description,
                isPublic,
                ownerId: userProfile.uid,
                admins: { [userProfile.uid]: true },
                members: selectedMembers,
                avatarUrl: `https://i.pravatar.cc/150?u=${chatId}`,
            };

            await set(newChatRef, newChatData);

            if (handle) {
                 await set(ref(db, `handles/${handle.toLowerCase()}`), { type: type, id: chatId });
            }

            const memberUpdates: Record<string, any> = {};
            Object.keys(selectedMembers).forEach(uid => {
                memberUpdates[`/users/${uid}/chats/${chatId}`] = true;
            });
            await update(ref(db), memberUpdates);
            
            setActiveChat(newChatData);
            onClose();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleMember = (uid: string) => {
        setSelectedMembers(prev => {
            const newSelected = {...prev};
            if(newSelected[uid]) {
                delete newSelected[uid];
            } else {
                newSelected[uid] = true;
            }
            return newSelected;
        });
    };

    const filteredUsers = memberSearch ? allUsers.filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.handle.toLowerCase().includes(memberSearch.toLowerCase())) : allUsers;

    const renderStep1 = () => (
        <div>
            <h3 className="text-xl font-bold mb-4 text-white text-center">New Message</h3>
             <div className="space-y-3">
                 <button onClick={() => { setType('group'); setStep(2); }} className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-700">
                     <UserGroupIcon className="w-6 h-6 text-gray-400"/>
                     <span className="font-medium text-gray-200 text-lg">New Group</span>
                 </button>
                 <button onClick={() => { setType('channel'); setStep(2); }} className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-700">
                     <HashtagIcon className="w-6 h-6 text-gray-400"/>
                     <span className="font-medium text-gray-200 text-lg">New Channel</span>
                 </button>
             </div>
        </div>
    );
    
    const renderStep2 = () => (
        <div>
            <div className="flex items-center mb-4">
                <button onClick={() => setStep(1)} className="p-2 -ml-2 text-gray-400 hover:text-white"><ArrowLeftIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-white">New {type === 'group' ? 'Group' : 'Channel'}</h3>
            </div>
            {error && <p className="text-red-400 mb-2 bg-red-900/50 p-2 rounded">{error}</p>}
            <div className="space-y-4">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                <input type="text" value={handle} onChange={e => setHandle(e.target.value)} placeholder="Handle (optional, unique)" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg" rows={2}/>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 text-blue-500 rounded focus:ring-blue-500"/>
                    <span className="text-gray-300">Public {type}</span>
                </label>
            </div>
            <div className="flex justify-end mt-6">
                 <button onClick={() => type === 'group' ? setStep(3) : handleCreate()} disabled={!name || loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-500">
                    {loading ? 'Creating...' : (type === 'group' ? 'Next' : 'Create')}
                 </button>
            </div>
        </div>
    );

    const renderStep3 = () => (
         <div>
            <div className="flex items-center mb-4">
                <button onClick={() => setStep(2)} className="p-2 -ml-2 text-gray-400 hover:text-white"><ArrowLeftIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-white">Add Members</h3>
            </div>
             <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search users..." className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg mb-4"/>
             <div className="max-h-60 overflow-y-auto space-y-2">
                {loading ? <Spinner /> : filteredUsers.map(user => (
                    <div key={user.uid} onClick={() => toggleMember(user.uid)} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-700">
                        <input type="checkbox" checked={!!selectedMembers[user.uid]} readOnly className="form-checkbox h-5 w-5 bg-gray-600 border-gray-500 text-blue-500 rounded-full focus:ring-blue-500" />
                        <Avatar src={user.avatarUrl} name={user.name} />
                        <div>
                            <p className="font-semibold text-white">{user.name}</p>
                            <p className="text-sm text-gray-400">@{user.handle}</p>
                        </div>
                    </div>
                ))}
             </div>
             <div className="flex justify-end mt-6">
                 <button onClick={handleCreate} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-500">
                    {loading ? 'Creating...' : `Create Group (${Object.keys(selectedMembers).length})`}
                 </button>
            </div>
        </div>
    );

    return (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </div>
        </div>
    );
};

const SearchModal: React.FC<{ userProfile: UserProfile; onClose: () => void; setActiveChat: (chat: Chat) => void }> = ({ userProfile, onClose, setActiveChat }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [allPublicChats, setAllPublicChats] = useState<Chat[]>([]);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            const usersRef = ref(db, 'users');
            const usersSnap = await get(usersRef);
            const users: UserProfile[] = [];
            if (usersSnap.exists()) {
                usersSnap.forEach(child => {
                    if (child.key !== userProfile.uid) {
                        users.push({ uid: child.key!, ...child.val() });
                    }
                });
            }
            setAllUsers(users);

            const chatsRef = query(ref(db, 'chats'));
            const chatsSnap = await get(chatsRef);
            const chats: Chat[] = [];
            if(chatsSnap.exists()){
                chatsSnap.forEach(child => {
                    const chatData = child.val();
                    if(chatData.isPublic){
                        chats.push({id: child.key!, ...chatData});
                    }
                });
            }
            setAllPublicChats(chats);
            setLoading(false);
        };
        fetchAllData();
    }, [userProfile.uid]);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setResults([]);
            return;
        }

        const combinedList = [
            ...allUsers.map(u => ({ ...u, resultType: 'user' })),
            ...allPublicChats.map(c => ({ ...c, resultType: c.type }))
        ];

        const searchResults = fuzzySearch(searchTerm, combinedList, ['name', 'handle']);
        setResults(searchResults);
    }, [searchTerm, allUsers, allPublicChats]);


    const handleResultClick = async (result: any) => {
        if (result.resultType === 'user') {
            const dmChatId = [userProfile.uid, result.uid].sort().join('_');
            const chatRef = ref(db, `chats/${dmChatId}`);
            const chatSnap = await get(chatRef);

            let chatToOpen: Chat;

            if (chatSnap.exists()) {
                chatToOpen = { id: dmChatId, ...chatSnap.val() };
            } else {
                chatToOpen = {
                    id: dmChatId,
                    type: 'dm',
                    name: 'DM',
                    members: {
                        [userProfile.uid]: true,
                        [result.uid]: true,
                    },
                };
                await set(chatRef, chatToOpen);
                await update(ref(db, `users/${userProfile.uid}/chats`), { [dmChatId]: true });
                await update(ref(db, `users/${result.uid}/chats`), { [dmChatId]: true });
            }
            setActiveChat(chatToOpen);
            onClose();

        } else {
            const chatToOpen = result as Chat;
            if(!chatToOpen.members[userProfile.uid]) {
                await update(ref(db, `chats/${chatToOpen.id}/members`), { [userProfile.uid]: true });
                await update(ref(db, `users/${userProfile.uid}/chats`), { [chatToOpen.id]: true });
            }
            setActiveChat(chatToOpen);
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-[10vh]" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search people, groups, and channels..."
                            className="w-full bg-gray-700 text-gray-200 rounded-lg py-2 pl-10 pr-4 focus:outline-none"
                            autoFocus
                        />
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {loading && <div className="p-4"><Spinner /></div>}
                    {!loading && results.map(result => (
                        <div key={result.id || result.uid} onClick={() => handleResultClick(result)} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-700">
                           <Avatar src={result.avatarUrl} name={result.name} />
                           <div>
                                <p className="font-semibold text-white">{result.name}</p>
                                <p className="text-sm text-gray-400">@{result.handle}</p>
                           </div>
                        </div>
                    ))}
                    {!loading && searchTerm && results.length === 0 && <p className="p-4 text-center text-gray-400">No results found.</p>}
                </div>
            </div>
        </div>
    );
};

// --- NEW SETTINGS & PROFILE COMPONENTS ---

const SettingsPage: React.FC<{userProfile: UserProfile, onClose: () => void}> = ({ userProfile, onClose }) => {
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const imageUrl = await uploadImage(file);
            if(imageUrl) {
                await update(ref(db, `users/${userProfile.uid}`), { avatarUrl: imageUrl });
            } else {
                alert("Avatar upload failed.");
            }
        }
    };

    const DropdownMenu = () => (
        <div ref={menuRef} className="absolute top-full right-0 mt-2 w-56 bg-gray-700 rounded-md shadow-lg z-10">
            <button onClick={() => { setIsEditingProfile(true); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 rounded-t-md"><PencilIcon className="w-5 h-5"/> Edit Info</button>
            <button onClick={() => { avatarInputRef.current?.click(); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"><CameraIcon className="w-5 h-5"/> Set Profile Photo</button>
            <button onClick={() => { signOut(auth); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-gray-600 rounded-b-md"><LogoutIcon className="w-5 h-5"/> Log Out</button>
        </div>
    );

    return (
        <>
        <div className="fixed inset-0 bg-gray-900 z-50 animate-slide-in-right">
            <div className="h-full flex flex-col">
                <header className="flex items-center justify-between p-3 bg-gray-800 flex-shrink-0">
                     <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-1 text-gray-300 hover:text-white"><ArrowLeftIcon className="w-6 h-6" /></button>
                     </div>
                     <div className="relative">
                        <button onClick={() => setIsMenuOpen(p => !p)} className="p-1 text-gray-300 hover:text-white">
                            <EllipsisVerticalIcon className="w-6 h-6" />
                        </button>
                        {isMenuOpen && <DropdownMenu />}
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 relative w-32 h-32">
                        <Avatar src={userProfile.avatarUrl} name={userProfile.name} size="xxl"/>
                        <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-900">
                            <CameraIcon className="w-5 h-5 text-white" />
                        </button>
                        <input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={handleAvatarChange} />
                    </div>
                    
                    <div className="mt-4">
                        <h4 className="px-4 py-2 text-blue-400 font-semibold text-sm">Account</h4>
                        <div className="bg-gray-800 rounded-lg mx-2">
                           <InfoItem label="Tap to change phone number" value={userProfile.phone} />
                           <InfoItem label="Username" value={`@${userProfile.handle}`} />
                           <InfoItem label="Bio" value={userProfile.bio || 'Not set'} last />
                        </div>

                        <h4 className="px-4 py-2 mt-4 text-blue-400 font-semibold text-sm">Settings</h4>
                         <div className="bg-gray-800 rounded-lg mx-2">
                            <ListItem icon={ChatBubbleOvalLeftEllipsisIcon} text="Chat Settings" onClick={() => {}} />
                            <ListItem icon={LockClosedIcon} text="Privacy and Security" onClick={() => {}} />
                            <ListItem icon={BellIcon} text="Notifications and Sounds" onClick={() => {}} />
                            <ListItem icon={CircleStackIcon} text="Data and Storage" onClick={() => {}} />
                            <ListItem icon={Battery50Icon} text="Power Saving" onClick={() => {}} />
                            <ListItem icon={LanguageIcon} text="Language" value="English" onClick={() => {}} last/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        {isEditingProfile && <EditProfilePage userProfile={userProfile} onClose={() => setIsEditingProfile(false)} />}
        </>
    );
};

const EditProfilePage: React.FC<{userProfile: UserProfile, onClose: () => void}> = ({ userProfile, onClose }) => {
    const [name, setName] = useState(userProfile.name);
    const [bio, setBio] = useState(userProfile.bio || '');
    const [birthday, setBirthday] = useState(userProfile.birthday || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setLoading(true);
        setError('');
        try {
            const updates: Partial<UserProfile> = { name, bio, birthday };
            await update(ref(db, `users/${userProfile.uid}`), updates);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 z-50 animate-slide-in-right">
             <header className="flex items-center justify-between p-3 bg-gray-800">
                <button onClick={onClose} className="p-2 text-gray-300 hover:text-white"><ArrowLeftIcon className="w-6 h-6" /></button>
                <h2 className="text-xl font-bold text-white">Profile Info</h2>
                <button onClick={handleSave} disabled={loading} className="p-2 text-blue-400 hover:text-blue-300 disabled:text-gray-500"><CheckIcon className="w-7 h-7" /></button>
            </header>
            <div className="p-6 space-y-10">
                {error && <p className="text-red-400 p-2 bg-red-900/50 rounded">{error}</p>}
                <div>
                    <div className="relative border-b-2 border-gray-600 focus-within:border-blue-500">
                        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className="block w-full bg-transparent text-white pt-4 pb-1 focus:outline-none" placeholder=" "/>
                        <label htmlFor="name" className="absolute top-4 left-0 text-gray-400 duration-300 transform -translate-y-6 scale-75 origin-[0] pointer-events-none">Your name</label>
                    </div>
                </div>
                 <div>
                    <div className="relative border-b-2 border-gray-600 focus-within:border-blue-500">
                        <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={70} className="block w-full bg-transparent text-white pt-4 pb-1 focus:outline-none resize-none" rows={1} placeholder=" "/>
                        <label htmlFor="bio" className="absolute top-4 left-0 text-gray-400 duration-300 transform -translate-y-6 scale-75 origin-[0] pointer-events-none">Your bio</label>
                    </div>
                    <div className="flex justify-between mt-1">
                        <p className="text-sm text-gray-500">You can add a few lines about yourself.</p>
                        <p className="text-sm text-gray-500">{bio.length}/70</p>
                    </div>
                </div>
                <div>
                    <div className="relative border-b-2 border-gray-600 focus-within:border-blue-500">
                        <input id="birthday" type="text" value={birthday} onChange={e => setBirthday(e.target.value)} className="block w-full bg-transparent text-white pt-4 pb-1 focus:outline-none" placeholder="Add"/>
                        <label htmlFor="birthday" className="absolute top-4 left-0 text-gray-400 duration-300 transform -translate-y-6 scale-75 origin-[0] pointer-events-none">Your birthday</label>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Choose who can see your birthday in Settings.</p>
                </div>
            </div>
        </div>
    );
};

const EntityInfoPage: React.FC<{ chat: Chat; currentUser: UserProfile; onClose: () => void; }> = ({ chat, currentUser, onClose }) => {
    const [entity, setEntity] = useState<UserProfile | Chat | null>(null);
    const [members, setMembers] = useState<UserProfile[]>([]);
    const [media, setMedia] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('media');
    const [loading, setLoading] = useState(true);

    const isGroupOrChannel = chat.type === 'group' || chat.type === 'channel';
    const isAdmin = chat.admins?.[currentUser.uid] || chat.ownerId === currentUser.uid;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            if(isGroupOrChannel) {
                setEntity(chat);
                const memberIds = Object.keys(chat.members);
                const promises = memberIds.map(id => get(ref(db, `users/${id}`)));
                const memberSnaps = await Promise.all(promises);
                const memberProfiles = memberSnaps
                    .map((snap, i) => snap.exists() ? ({ uid: memberIds[i], ...snap.val() } as UserProfile) : null)
                    .filter((p): p is UserProfile => p !== null);
                setMembers(memberProfiles);

                const messagesSnap = await get(query(ref(db, `chats/${chat.id}/messages`)));
                const images: string[] = [];
                if(messagesSnap.exists()) {
                    messagesSnap.forEach(child => {
                        if(child.val().imageUrl) images.push(child.val().imageUrl);
                    });
                }
                setMedia(images.reverse());

            } else { // DM
                const otherUserId = Object.keys(chat.members).find(id => id !== currentUser.uid)!;
                const userSnap = await get(ref(db, `users/${otherUserId}`));
                if(userSnap.exists()) setEntity({ uid: otherUserId, ...userSnap.val() } as UserProfile);
            }
            setLoading(false);
        }
        fetchData();
    }, [chat, currentUser.uid, isGroupOrChannel]);

    if (loading) return <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center"><Spinner /></div>;
    if (!entity) return null;

    const renderUserContent = (user: UserProfile) => (
        <>
            <h4 className="px-4 py-2 mt-4 text-blue-400 font-semibold text-sm">Info</h4>
            <div className="bg-gray-800 rounded-lg mx-2">
                {user.privacy?.showPhoneNumber === 'everyone' && <InfoItem label="Mobile" value={user.phone} />}
                <InfoItem label="Bio" value={user.bio || 'No bio yet.'} />
                <InfoItem label="Username" value={`@${user.handle}`} last/>
            </div>
        </>
    );

    const renderGroupContent = (group: Chat) => (
        <>
            <div className="p-4 flex gap-4">
                <button className="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700"><BellIcon className="w-6 h-6 text-gray-300"/> <span className="text-sm">Mute</span></button>
                <button className="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700"><SearchIcon className="w-6 h-6 text-gray-300"/> <span className="text-sm">Search</span></button>
                <button className="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg bg-red-900/50 hover:bg-red-900"><LogoutIcon className="w-6 h-6 text-red-400"/> <span className="text-sm text-red-400">Leave</span></button>
            </div>
            
            {isAdmin && <div className="bg-gray-800 rounded-lg mx-2 mt-4"><ListItem icon={UserPlusIcon} text="Add Members" onClick={() => {}} last/></div>}

            <div className="bg-gray-800 rounded-lg mx-2 mt-4">
                {members.map(member => (
                    <div key={member.uid} className="flex items-center gap-3 p-3 border-b border-gray-700/50 last:border-b-0">
                        <Avatar src={member.avatarUrl} name={member.name} />
                        <div className="flex-1">
                            <p className="font-semibold text-white">{member.name}</p>
                            <p className="text-sm text-blue-400">online</p>
                        </div>
                        {(group.admins?.[member.uid] || group.ownerId === member.uid) && <span className="text-sm text-gray-400">Admin</span>}
                    </div>
                ))}
            </div>

            <div className="mt-4">
                <div className="flex border-b border-gray-700">
                    <button onClick={() => setActiveTab('media')} className={`flex-1 py-2 text-center font-semibold ${activeTab === 'media' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>Media</button>
                    <button className="flex-1 py-2 text-center font-semibold text-gray-600 cursor-not-allowed">Files</button>
                    <button className="flex-1 py-2 text-center font-semibold text-gray-600 cursor-not-allowed">Links</button>
                </div>
                <div className="p-2 grid grid-cols-3 gap-1">
                    {media.map((url, idx) => <img key={idx} src={url} className="aspect-square w-full h-full object-cover rounded" alt={`media ${idx}`}/>)}
                </div>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 bg-gray-900 z-50 animate-slide-in-right">
            <div className="h-full flex flex-col">
                <header className="flex items-center justify-between p-3 bg-gray-800">
                    <button onClick={onClose} className="p-2 text-gray-300 hover:text-white"><ArrowLeftIcon className="w-6 h-6" /></button>
                     {isAdmin && <button className="p-2 text-gray-300 hover:text-white"><PencilSquareIcon className="w-6 h-6" /></button>}
                </header>
                <div className="flex-1 overflow-y-auto pb-8">
                    <div className="p-4 flex flex-col items-center gap-2">
                        <Avatar src={entity.avatarUrl} name={entity.name} size="xl" />
                        <h2 className="text-2xl font-bold text-white">{entity.name}</h2>
                        {isGroupOrChannel ? 
                            <p className="text-gray-400">{members.length} members</p>
                            : <p className="text-gray-400">online</p>
                        }
                    </div>
                    {isGroupOrChannel ? renderGroupContent(entity as Chat) : renderUserContent(entity as UserProfile)}
                </div>
            </div>
        </div>
    );
}

export default App;
