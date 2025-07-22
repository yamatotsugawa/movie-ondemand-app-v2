'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';


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

interface LatestComment {
  id: string;
  movieId: string;
  movieTitle: string;
  text: string;
  createdAt: any;
}

export default function Home() {
  const router = useRouter();
  const [movieTitle, setMovieTitle] = useState('');
  const [results, setResults] = useState<AppMovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestComments, setLatestComments] = useState<LatestComment[]>([]);

  useEffect(() => {
  const fetchLatestComments = async () => {
    const q = query(
      collection(db, 'chatSummaries'),
      orderBy('lastMessageAt', 'desc'),
      limit(10)
    );
    const snapshot = await getDocs(q);
    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      movieId: doc.data().movieId,
      movieTitle: doc.data().title,
      text: doc.data().lastMessageText,
      createdAt: doc.data().lastMessageAt,
    }));
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);

    if (!movieTitle.trim()) {
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
      const searchUrl = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(movieTitle)}&api_key=${TMDB_API_KEY}&language=ja-JP`;
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
    <div style={styles.container}>
      <h1 style={styles.title}>どのオンデマンドで観れる？</h1>
      <form onSubmit={handleSearch} style={styles.form}>
        <input
          type="text"
          value={movieTitle}
          onChange={(e) => setMovieTitle(e.target.value)}
          placeholder="映画名を入力してください"
          style={styles.input}
          disabled={loading}
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? '検索中...' : '検索'}
        </button>
      </form>
      <p style={styles.noticeText}>結果が出てこない場合はスペースなどを入れるか英語名で検索してみてください。</p>
      {error && <p style={styles.errorText}>{error}</p>}

      <div style={styles.resultsContainer}>
        {results.length > 0 && (
          <>
            <h2 style={styles.resultsTitle}>検索結果</h2>
            {results.map((movie) => (
              <div key={movie.id} style={styles.card}>
                <div style={styles.posterSection}>
                  {movie.poster_path && (
                    <Image src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`} alt={movie.title} width={130} height={200} style={{ borderRadius: '8px' }} />
                  )}
                  <button onClick={() => router.push(`/chat/${movie.id}`)} style={styles.chatButton}>
                    この映画について語る
                  </button>
                </div>
                <div style={styles.movieDetails}>
                  <h3 style={styles.movieTitle}>{movie.title}（{movie.release_date?.slice(0, 4)}）</h3>
                  <p style={styles.movieOverview}>{movie.overview?.slice(0, 200)}...</p>
                  <div>
                    <strong>視聴可能サービス：</strong>
                    {movie.streamingServices?.length ? (
                      <div style={styles.providerLogos}>
                        {movie.streamingServices.map((s, i) => (
                          <a key={i} href={s.link} target="_blank" rel="noopener noreferrer">
                            <Image src={`https://image.tmdb.org/t/p/w45${s.logo}`} alt={s.name} width={30} height={30} style={styles.providerLogo} />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#999', fontSize: '14px' }}>現在、視聴可能なサービス情報は見つかりませんでした。</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

            <div className="mt-12 border-t pt-6">
        <h2 className="text-xl font-semibold text-center mb-4">最新の書き込み</h2>
        {latestComments.length === 0 ? (
          <p className="text-center text-gray-400">まだ書き込みはありません</p>
        ) : (
          <ul className="space-y-2">
            {latestComments.map((comment, index) => {
              const date = comment.createdAt?.seconds
                ? new Date(comment.createdAt.seconds * 1000).toLocaleString('ja-JP')
                : '日時不明';

              return (
                <li
  key={index}
  className="flex items-center border-b pb-1 gap-2"
>
  {/* 映画タイトル */}
  <span
    className="text-blue-600 underline cursor-pointer shrink-0 w-32"
    onClick={() => router.push(`/?title=${encodeURIComponent(comment.movieTitle)}`)}
  >
    {comment.movieTitle}
  </span>

  {/* コメント本文（整列用） */}
  <span
    className="flex-1 text-sm truncate cursor-pointer"
    onClick={() => router.push(`/chat/${comment.movieId}`)}
  >
    {comment.text}
  </span>

  {/* 日付 */}
  <span className="text-xs text-gray-500 shrink-0 ml-2 whitespace-nowrap">
    {date}
  </span>
</li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}


const styles: { [key: string]: React.CSSProperties } = {
  container: { fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '40px auto', padding: '20px', backgroundColor: '#fff', borderRadius: '12px' },
  title: { textAlign: 'center', fontSize: '28px', color: '#222', marginBottom: '20px' },
  form: { display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' },
  noticeText: { textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '20px' },
  input: { padding: '12px', fontSize: '16px', width: '60%', borderRadius: '6px', border: '1px solid #ccc' },
  button: { padding: '12px 20px', fontSize: '16px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  errorText: { color: 'red', textAlign: 'center', margin: '10px 0' },
  resultsContainer: { marginTop: '30px' },
  resultsTitle: { textAlign: 'center', fontSize: '22px', marginBottom: '20px' },
  card: { backgroundColor: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px', display: 'flex', gap: '20px' },
  posterSection: { flex: '0 0 auto', textAlign: 'center' },
  chatButton: { marginTop: '12px', backgroundColor: '#0070f3', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  movieDetails: { flex: '1 1 auto' },
  movieTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' },
  movieOverview: { fontSize: '14px', color: '#555', lineHeight: '1.6' },
  providerLogos: { marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' },
  providerLogo: { borderRadius: '4px', border: '1px solid #ddd' },
  noResults: { textAlign: 'center', color: '#999', fontSize: '14px' },
  latestContainer: { marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #eee' },
  latestTitle: { fontSize: '20px', marginBottom: '16px', textAlign: 'center' },
  commentBox: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', padding: '8px 0', cursor: 'pointer' },
  commentTitle: { color: '#0070f3', textDecoration: 'underline', marginRight: '16px', flex: '0 0 auto' },
  commentText: { flex: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#222' },
};
