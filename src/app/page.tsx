// src/app/page.tsx

'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import Link from 'next/link';

interface LatestComment {
  id: string;
  movieId: string;
  movieTitle: string;
  text: string;
  createdAt: Timestamp | null;
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

interface MovieData {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
}

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

interface AppMovieResult {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  streamingServices?: { name: string; logo: string; link?: string }[];
  justWatchLink?: string;
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [movieTitle, setMovieTitle] = useState('');
  const [results, setResults] = useState<AppMovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestComments, setLatestComments] = useState<LatestComment[]>([]);

  useEffect(() => {
    const titleParam = searchParams.get('title');
    if (titleParam) {
      setMovieTitle(titleParam);
      handleSearch(undefined, titleParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchLatestComments = async () => {
      const q = query(
        collection(db, 'chatSummaries'),
        orderBy('lastMessageAt', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const comments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          movieId: data.movieId || '',
          movieTitle: data.title || '',
          text: data.lastMessageText || '',
          createdAt: data.lastMessageAt || null,
        } as LatestComment;
      });
      setLatestComments(comments);
    };
    fetchLatestComments();
  }, []);

  const getServiceSpecificLink = (providerName: string, movieTitle: string, justWatchMovieLink?: string): string => {
    const encodedMovieTitle = encodeURIComponent(movieTitle);
    switch (providerName) {
      case 'Amazon Prime Video':
        return `https://www.amazon.co.jp/s?k=${encodedMovieTitle}&i=instant-video`;
      case 'Netflix':
        return 'https://www.netflix.com/jp/';
      case 'U-NEXT':
        return 'https://video.unext.jp/';
      case 'Hulu':
        return 'https://www.hulu.jp/';
      case 'Disney Plus':
        return 'https://www.disneyplus.com/ja-jp';
      case 'Apple TV':
        return `https://tv.apple.com/jp/search/${encodedMovieTitle}`;
      case 'Google Play Movies':
        return `https://play.google.com/store/search?q=${encodedMovieTitle}&c=movies`;
      case 'YouTube':
        return `https://www.youtube.com/results?search_query=${encodedMovieTitle}+full+movie`;
      default:
        return justWatchMovieLink || '#';
    }
  };

  const handleSearch = async (e?: React.FormEvent, overrideTitle?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);

    const queryTitle = overrideTitle ?? movieTitle;

    if (!queryTitle.trim()) {
      setError('映画名を入力してください。');
      setLoading(false);
      return;
    }

    if (!TMDB_API_KEY) {
      setError('APIキーが設定されていません。`.env.local`を確認してください。');
      setLoading(false);
      return;
    }

    try {
      const searchUrl = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(queryTitle)}&api_key=${TMDB_API_KEY}&language=ja-JP`;
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) throw new Error(`映画検索に失敗しました: ${searchResponse.statusText}`);
      const searchData: { results: MovieData[] } = await searchResponse.json();

      if (searchData.results?.length > 0) {
        const moviesWithStreaming = await Promise.all(
          searchData.results.map(async (movie) => {
            try {
              const providersUrl = `${TMDB_BASE_URL}/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`;
              const providersResponse = await fetch(providersUrl);

              let justWatchLink: string | undefined = undefined;
              let services: { name: string; logo: string; link?: string }[] = [];

              if (providersResponse.ok) {
                const providersData = await providersResponse.json();
                const jpProviders = providersData.results?.JP;
                justWatchLink = jpProviders?.link;

                const addServices = (providerList: Provider[] | undefined) => {
                  providerList?.forEach((p) => {
                    services.push({
                      name: p.provider_name,
                      logo: p.logo_path,
                      link: getServiceSpecificLink(p.provider_name, movie.title, justWatchLink),
                    });
                  });
                };

                addServices(jpProviders?.flatrate);
                addServices(jpProviders?.buy);
                addServices(jpProviders?.rent);

                services = Array.from(new Map(services.map((item) => [item.name, item])).values());
              }

              return {
                ...movie,
                streamingServices: services,
                justWatchLink,
              };
            } catch {
              return {
                ...movie,
                streamingServices: [],
                justWatchLink: undefined,
              };
            }
          })
        );

        setResults(moviesWithStreaming);
      } else {
        setError('一致する映画が見つかりませんでした。');
      }
    } catch (err) {
      setError(err instanceof Error ? `検索中にエラーが発生しました: ${err.message}` : '予期せぬエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-screen-lg mx-auto px-4 py-6">
      <h1 className="text-2xl sm:text-3xl text-center font-bold mb-4">どのオンデマンドで観れる？</h1>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row justify-center gap-2 mb-4 px-2">
        <input
          type="text"
          value={movieTitle}
          onChange={(e) => setMovieTitle(e.target.value)}
          placeholder="映画名を入力してください"
          className="p-2 border rounded-md flex-grow"
          disabled={loading}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md" disabled={loading}>
          {loading ? '検索中...' : '検索'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mb-6">結果が出てこない場合はスペースなどを入れるか英語名で検索してみてください。</p>
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-8">
          <h2 className="text-xl font-semibold text-center">検索結果</h2>
          {results.map((movie) => (
            <div key={movie.id} className="bg-white p-3 sm:p-4 rounded-lg shadow-md flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col items-center">
                {movie.poster_path && (
                  <Image src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`} alt={movie.title} width={100} height={150} className="rounded-md" />
                )}
                <button onClick={() => router.push(`/chat/${movie.id}`)} className="mt-2 bg-blue-600 text-white px-3 py-1 rounded-md">
                  この映画について語る
                </button>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">{movie.title}（{movie.release_date?.slice(0, 4)}）</h3>
                <p className="text-sm text-gray-700 mb-2">{movie.overview?.slice(0, 200)}...</p>
                <div>
                  <strong className="block mb-1">視聴可能サービス：</strong>
                  {movie.streamingServices?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {movie.streamingServices.map((s, i) => (
                        <a key={i} href={s.link} target="_blank" rel="noopener noreferrer">
                          <Image src={`https://image.tmdb.org/t/p/w45${s.logo}`} alt={s.name} width={30} height={30} className="rounded border" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">現在、視聴可能なサービス情報は見つかりませんでした。</p>
                  )}
                  <a href={`https://www.amazon.co.jp/s?k=${encodeURIComponent(movie.title)}&i=dvd`} target="_blank" rel="noopener noreferrer">
                    <button className="mt-2 bg-yellow-400 px-3 py-1 text-sm text-black rounded w-full sm:w-auto">DVDを探す</button>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 border-t pt-6">
        <h2 className="text-xl font-semibold text-center mb-4">最新の書き込み</h2>
        {latestComments.length === 0 ? (
          <p className="text-center text-gray-400">まだ書き込みはありません</p>
        ) : (
          <ul className="space-y-2">
  {latestComments.map((comment, index) => {
    const date = comment.createdAt?.seconds
      ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString('ja-JP')
      : '日時不明';

    return (
      <li key={index} className="flex flex-col sm:flex-row sm:items-center border-b pb-2 gap-1 sm:gap-2">
        <Link href={`/?title=${encodeURIComponent(comment.movieTitle)}`}>
          <span className="text-blue-600 underline cursor-pointer shrink-0">
            {comment.movieTitle}
          </span>
        </Link>
        <Link href={`/chat/${comment.movieId}`}>
          <span className="flex-1 text-sm truncate cursor-pointer">
            {comment.text}
          </span>
        </Link>
        <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
          {date}
        </span>
      </li>
    );
  })}
</ul>
        )}
      </div>
    </main>
  );
}