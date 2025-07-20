// src/app/page.tsx
'use client';

import { useState } from 'react';
import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

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
  const [movieTitle, setMovieTitle] = useState('');
  const [results, setResults] = useState<AppMovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ストリーミングサービスごとの検索リンクを生成する関数を更新
  const getServiceSpecificLink = (providerName: string, movieTitle: string, justWatchMovieLink?: string): string => {
    const encodedMovieTitle = encodeURIComponent(movieTitle);
    switch (providerName) {
      case 'Amazon Prime Video':
        return `https://www.amazon.co.jp/s?k=${encodedMovieTitle}&i=instant-video`;
      case 'Netflix':
        // Netflixは直接検索URLが不安定なため、メインページに遷移
        return 'https://www.netflix.com/jp/';
      case 'U-NEXT':
        // U-NEXTも直接検索URLが不安定なため、メインページに遷移
        return 'https://video.unext.jp/';
      case 'Hulu':
        // Huluも直接検索URLが不安定なため、メインページに遷移
        return 'https://www.hulu.jp/';
      case 'Disney Plus':
        // Disney+も直接検索URLが不安定なため、メインページに遷移
        return 'https://www.disneyplus.com/ja-jp';
      case 'Apple TV':
        return `https://tv.apple.com/jp/search/${encodedMovieTitle}`;
      case 'Google Play Movies':
        return `https://play.google.com/store/search?q=${encodedMovieTitle}&c=movies`;
      case 'YouTube':
        return `https://www.youtube.com/results?search_query=${encodedMovieTitle}+full+movie`;
      default:
        // その他のサービスや、上記で検索URLが見つからない場合のフォールバック
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
      if (!searchResponse.ok) {
        throw new Error(`映画検索に失敗しました: ${searchResponse.statusText}`);
      }
      const searchData: { results: MovieData[] } = await searchResponse.json();

      if (searchData.results && searchData.results.length > 0) {
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
                  if (providerList) {
                    providerList.forEach((p) => {
                      services.push({
                        name: p.provider_name,
                        logo: p.logo_path,
                        link: getServiceSpecificLink(p.provider_name, movie.title, justWatchLink),
                      });
                    });
                  }
                };

                console.log('JP Providers:', jpProviders);
                addServices(jpProviders?.flatrate);
                addServices(jpProviders?.buy);
                addServices(jpProviders?.rent);
                console.log('Services collected:', services);

                services = Array.from(new Map(services.map((item) => [item.name, item])).values());
              }

              return {
                id: movie.id,
                title: movie.title,
                release_date: movie.release_date,
                overview: movie.overview,
                poster_path: movie.poster_path,
                streamingServices: services,
                justWatchLink,
              };
            } catch {
              return {
                id: movie.id,
                title: movie.title,
                release_date: movie.release_date,
                overview: movie.overview,
                poster_path: movie.poster_path,
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
      if (err instanceof Error) {
        setError(`検索中にエラーが発生しました: ${err.message}`);
      } else {
        setError('予期せぬエラーが発生しました');
      }
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
      <p style={styles.noticeText}>
        結果が出てこない場合はスペースなどを入れるか英語名で検索してみてください。
      </p>
      {error && <p style={styles.errorText}>{error}</p>}
      <div style={styles.resultsContainer}>
        {results.length > 0 ? (
          <>
            <h2 style={styles.resultsTitle}>検索結果</h2>
            {results.map((movie) => (
              <div key={movie.id} style={styles.card}>
                <div style={styles.posterSection}>
                  {movie.poster_path && (
                    <Image
                      src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                      alt={movie.title}
                      width={130}
                      height={200}
                      style={{ borderRadius: '8px' }}
                    />
                  )}
                  <button
                    onClick={() => router.push(`/chat/${movie.id}`)}
                    style={styles.chatButton}
                  >
                    この映画について語る
                  </button>
                </div>
                <div style={styles.movieDetails}>
                  <h3 style={styles.movieTitle}>
                    {movie.title}（{movie.release_date?.slice(0, 4)}）
                  </h3>
                  <p style={styles.movieOverview}>
                    {movie.overview?.slice(0, 200)}...
                  </p>
                  <div>
                    <strong>視聴可能サービス：</strong>
                    {movie.streamingServices?.length ? (
                      <div style={styles.providerLogos}>
                        {movie.streamingServices.map((s, i) => (
                          <a
                            key={i}
                            href={s.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Image
                              src={`https://image.tmdb.org/t/p/w45${s.logo}`}
                              alt={s.name}
                              width={30}
                              height={30}
                              style={styles.providerLogo}
                            />
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
        ) : (
          !loading && !error && <p style={styles.noResults}>映画名を入力して検索してください。</p>
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '900px',
    margin: '40px auto',
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
  },
  title: {
    textAlign: 'center',
    fontSize: '28px',
    color: '#222',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  noticeText: {
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
    marginBottom: '20px',
  },
  input: {
    padding: '12px',
    fontSize: '16px',
    width: '60%',
    borderRadius: '6px',
    border: '1px solid #ccc',
  },
  button: {
    padding: '12px 20px',
    fontSize: '16px',
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    margin: '10px 0',
  },
  resultsContainer: {
    marginTop: '30px',
  },
  resultsTitle: {
    textAlign: 'center',
    fontSize: '22px',
    marginBottom: '20px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '24px',
    display: 'flex',
    gap: '20px',
  },
  posterSection: {
    flex: '0 0 auto',
    textAlign: 'center',
  },
  chatButton: {
    marginTop: '12px',
    backgroundColor: '#0070f3',
    color: '#fff',
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  movieDetails: {
    flex: '1 1 auto',
  },
  movieTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  movieOverview: {
    fontSize: '14px',
    color: '#555',
    lineHeight: '1.6',
  },
  providerLogos: {
    marginTop: '10px',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  providerLogo: {
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  noResults: {
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
  },
};
