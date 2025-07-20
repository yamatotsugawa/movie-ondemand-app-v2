// src/app/chat/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import React from 'react'; // useState, useEffect, useRef などは不要になります

// TMDB APIの基本URLとAPIキー (工事中表示のため不要ですが、残しておきます)
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

// グローバル変数 (工事中表示のため不要ですが、残しておきます)
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;
declare const __app_id: string | undefined;

// 映画データのインターフェース (映画情報の取得は行わないため、ここでは不要ですが、残しておきます)
interface MovieData {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
}

// チャットメッセージのインターフェース (チャット機能がないため不要ですが、残しておきます)
interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  timestamp: any;
}

// Firestoreに保存するメッセージの形式 (チャット機能がないため不要ですが、残しておきます)
interface NewChatMessage {
  userId: string;
  text: string;
  timestamp: any;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const movieId = params.id as string; // URLから映画IDを取得

  // 映画情報やチャットメッセージの状態管理は不要になります
  // const [movie, setMovie] = useState<MovieData | null>(null);
  // const [loadingMovie, setLoadingMovie] = useState(true);
  // const [movieError, setMovieError] = useState<string | null>(null);
  // const [messages, setMessages] = useState<ChatMessage[]>([]);
  // const [inputMessage, setInputMessage] = useState('');
  // const [loadingChat, setLoadingChat] = useState(false);
  // const [chatError, setChatError] = useState<string | null>(null);
  // const [app, setApp] = useState<FirebaseApp | null>(null);
  // const [db, setDb] = useState<Firestore | null>(null);
  // const [auth, setAuth] = useState<Auth | null>(null);
  // const [currentUser, setCurrentUser] = useState<User | null>(null);
  // const [isAuthReady, setIsAuthReady] = useState(false);
  // const messagesEndRef = useRef<HTMLDivElement>(null);

  // シンプルな工事中表示を返します
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>チャットルーム（映画ID: {movieId}）</h1>
      <p style={styles.underConstructionText}>
        現在、このチャットルームは工事中です。
        <br />
        より良い体験を提供できるよう、現在開発を進めております。
        <br />
        ご迷惑をおかけしますが、今しばらくお待ちください。
      </p>
      <button onClick={() => router.back()} style={styles.backButton}>
        前のページに戻る
      </button>
    </div>
  );
}

// スタイル定義 (工事中表示に必要な最小限のスタイル)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: 'Inter, Arial, sans-serif',
    maxWidth: '600px',
    margin: '80px auto',
    padding: '40px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
  },
  title: {
    fontSize: '32px',
    color: '#333',
    marginBottom: '15px',
  },
  underConstructionText: {
    fontSize: '18px',
    color: '#666',
    lineHeight: '1.8',
    marginBottom: '30px',
  },
  backButton: {
    padding: '12px 25px',
    fontSize: '18px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    alignSelf: 'center',
    transition: 'background-color 0.2s',
    // '&:hover': { // この行と次の行を削除またはコメントアウト
    //   backgroundColor: '#5a6268',
    // },
  },
};
