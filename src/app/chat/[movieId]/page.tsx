// src/app/chat/[movieId]/page.tsx

'use client';

import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import Image from 'next/image';

// --- 追加ここから ---
interface Movie {
  title: string;
  poster_path: string | null; // ポスターがない場合もあるのでnullを許容
}
// --- 追加ここまで ---

type Message = {
  id: string;
  text: string;
  timestamp: Timestamp;
};

export default function ChatRoomPage() {
  const { movieId } = useParams();
  // --- 修正ここから ---
  const [movieData, setMovieData] = useState<Movie | null>(null); // anyからMovieまたはnullへ変更
  // --- 修正ここまで ---
  const [comment, setComment] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  // 映画データ取得
  useEffect(() => {
    const fetchMovieData = async () => {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${movieId}?language=ja-JP&api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
      );
      const data: Movie = await res.json(); // 取得したデータをMovie型として扱う
      setMovieData(data);
    };
    if (movieId) fetchMovieData();
  }, [movieId]);

  // Firestoreからメッセージ取得
  useEffect(() => {
    if (!movieId) return;
    const q = query(
      collection(db, 'chats', movieId as string, 'messages'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[]
      );
    });
    return () => unsubscribe();
  }, [movieId]);

  // コメント送信
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!comment.trim()) return;

    await addDoc(collection(db, 'chats', movieId as string, 'messages'), {
      text: comment,
      timestamp: Timestamp.now(),
    });

    await setDoc(doc(db, 'chatSummaries', movieId as string), {
      movieId,
      title: movieData?.title || '', // movieDataがnullの可能性があるのでオプショナルチェイニング
      lastMessageText: comment,
      lastMessageAt: serverTimestamp(),
    });

    setComment('');
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      {movieData && (
        <div className="text-center mb-4">
          {/* movieData.poster_path が null の可能性があるので条件付きで表示 */}
          {movieData.poster_path && (
            <Image
              src={`https://image.tmdb.org/t/p/w300${movieData.poster_path}`}
              alt={movieData.title}
              width={150}
              height={225}
              className="mx-auto rounded shadow"
            />
          )}
          <h2 className="text-xl font-bold mt-2">
            この映画「{movieData.title}」について語ろう
          </h2>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <textarea
          className="flex-grow p-2 border rounded resize-none h-24"
          placeholder="メッセージを入力（改行もできます）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          送信
        </button>
      </form>

      <div>
        {messages.map((msg) => (
          <div key={msg.id} className="mb-3 border-b pb-2">
            <p className="whitespace-pre-wrap">{msg.text}</p>
            <p className="text-sm text-gray-500">
              {msg.timestamp?.toDate?.().toLocaleString() ?? ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}