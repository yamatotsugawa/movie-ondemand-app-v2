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
import Link from 'next/link';

interface Movie {
  title: string;
  poster_path: string | null;
}

type Message = {
  id: string;
  text: string;
  timestamp: Timestamp;
};

export default function ChatRoomPage() {
  const { movieId } = useParams();
  const [movieData, setMovieData] = useState<Movie | null>(null);
  const [comment, setComment] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    const fetchMovieData = async () => {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${movieId}?language=ja-JP&api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
      );
      const data: Movie = await res.json();
      setMovieData(data);
    };
    if (movieId) fetchMovieData();
  }, [movieId]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!comment.trim()) return;

    await addDoc(collection(db, 'chats', movieId as string, 'messages'), {
      text: comment,
      timestamp: Timestamp.now(),
    });

    await setDoc(doc(db, 'chatSummaries', movieId as string), {
      movieId,
      title: movieData?.title || '',
      lastMessageText: comment,
      lastMessageAt: serverTimestamp(),
    });

    setComment('');
  };

  return (
    <main className="max-w-screen-md mx-auto px-4 py-6">
      {/* ホームに戻るボタン */}
      <div className="mb-4">
        <Link href="/" passHref>
          <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded">
            ホームに戻る
          </button>
        </Link>
      </div>

      {/* 映画情報表示 */}
      {movieData && (
        <div className="text-center mb-4">
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

      {/* SNS共有ボタン */}
      {currentUrl && movieData && (
        <div className="flex justify-center gap-4 mt-6">
          <a
      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `この映画「${movieData.title}」について語ろう！`
      )}&url=${encodeURIComponent(currentUrl)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded"
    >
      Xで共有
    </a>
          <a
            href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(
              currentUrl
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            LINEで共有
          </a>
        </div>
      )}

      {/* コメント投稿フォーム */}
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

      {/* メッセージ一覧 */}
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
    </main>
  );
}
