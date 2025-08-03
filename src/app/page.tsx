'use client';

import { useState, useEffect, Suspense } from 'react';
import React from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs, DocumentData } from 'firebase/firestore';
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
  poster_path?: string; // 例: "/abc.jpg" or "abc.jpg"
  vote_count?: number;
}

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string; // 例: "/xyz.png"
}

interface AppMovieResult extends MovieData {
  streamingServices?: { name: string; logo: string; link?: string }[];
  justWatchLink?: string;
}

// ========== ユーティリティ ==========

// 文字列正規化（タイトル・キーワード比較用）
function normalizeTitle(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[“”"‘’'・・‐—\-:：、，。!?？.\(\)\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// TMDB 画像URLを安全に組み立て（先頭スラッシュ重複や欠損をケア）
function tmdbImg(path: string | undefined, size: 'w45' | 'w92' | 'w154' | 'w185' | 'w200' | 'w300' | 'original') {
  if (!path) return '';
  const p = path.startsWith('/') ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/${size}${p}`;
}

// ========== Component ==========

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [movieTitle, setMovieTitle] = useState('');
  const [searchMode, setSearchMode] = useState<'title' | 'content'>('title');
  const [results, setResults] = useState<AppMovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestComments, setLatestComments] = useState<LatestComment[]>([]);

  // 最新の書き込みを取得
  useEffect(() => {
    const fetchLatestComments = async () => {
      const q = query(collection(db, 'chatSummaries'), orderBy('lastMessageAt', 'desc'), limit(10));
      const snapshot = await getDocs(q);
      setLatestComments(
        snapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData;
          return {
            id: doc.id,
            movieId: (data.movieId as string) || '',
            movieTitle: (data.title as string) || '',
            text: (data.lastMessageText as string) || '',
            createdAt: (data.lastMessageAt as Timestamp) || null,
          } as LatestComment;
        })
      );
    };
    fetchLatestComments();
  }, []);

  // URLクエリ(title=)があればタイトル検索モードに切り替え
  useEffect(() => {
    const titleParam = searchParams.get('title');
    if (titleParam) {
      setMovieTitle(titleParam);
      setSearchMode('title');
      void handleSearch(undefined, titleParam, 'title');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // TMDB検索（日本語+英語）
  const searchTMDBBoth = async (title: string, limit: number = 2): Promise<MovieData[]> => {
    const urlJa = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}&language=ja-JP`;
    const urlEn = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}&language=en-US`;

    const [resJa, resEn] = await Promise.all([fetch(urlJa), fetch(urlEn)]);
    const [jsonJa, jsonEn]: [{ results: MovieData[] }, { results: MovieData[] }] = await Promise.all([
      resJa.json(),
      resEn.json(),
    ]);

    const jaResults = jsonJa?.results ?? [];
    const enResults = jsonEn?.results ?? [];

    const mergedMap = new Map<number, MovieData>();
    for (const m of [...jaResults, ...enResults]) {
      if (!mergedMap.has(m.id)) {
        mergedMap.set(m.id, m);
      } else {
        const existing = mergedMap.get(m.id)!;
        if ((!existing.title || /^[A-Za-z0-9\s]+$/.test(existing.title)) && m.title) {
          existing.title = m.title;
        }
        if ((!existing.overview || (existing.overview || '').length < 5) && m.overview) {
          existing.overview = m.overview;
        }
        mergedMap.set(m.id, existing);
      }
    }

    return Array.from(mergedMap.values()).slice(0, limit);
  };

  // 視聴サービスリンク作成
  const getServiceSpecificLink = (providerName: string, movieTitle: string, justWatchMovieLink?: string): string => {
    const encoded = encodeURIComponent(movieTitle);
    switch (providerName) {
      case 'Amazon Prime Video':
        return `https://www.amazon.co.jp/s?k=${encoded}&i=instant-video`;
      case 'Netflix':
        return 'https://www.netflix.com/jp/';
      case 'U-NEXT':
        return 'https://video.unext.jp/';
      case 'Hulu':
        return 'https://www.hulu.jp/';
      case 'Disney Plus':
        return 'https://www.disneyplus.com/ja-jp';
      case 'Apple TV':
        return `https://tv.apple.com/jp/search/${encoded}`;
      case 'Google Play Movies':
        return `https://play.google.com/store/search?q=${encoded}&c=movies`;
      case 'YouTube':
        return `https://www.youtube.com/results?search_query=${encoded}+full+movie`;
      default:
        return justWatchMovieLink || '#';
    }
  };

  // API の型（最小限）
  interface GoogleSearchResponse {
    items?: { title: string; link?: string; snippet: string }[];
  }
  interface ExtractedTitles {
    titlesJa?: string[];
    titlesEn?: string[];
  }

  // メイン検索
  const handleSearch = async (
    e?: React.FormEvent,
    overrideTitle?: string,
    forceMode?: 'title' | 'content'
  ) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);

    const queryText = overrideTitle ?? movieTitle;
    const mode = forceMode ?? searchMode;

    if (!queryText.trim()) {
      setError('映画名またはキーワードを入力してください。');
      setLoading(false);
      return;
    }

    try {
      let movieCandidates: MovieData[] = [];

      if (mode === 'title') {
        // タイトル検索：JP/EN 両方でTMDB検索
        movieCandidates = await searchTMDBBoth(queryText, 10);
      } else {
        // ========= 内容検索 =========

        // 1) Google検索（/api/search）
        const googleRes = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryText }),
        });

        if (!googleRes.ok) {
          console.error('Google APIエラー:', googleRes.status);
          setError('Google検索に失敗しました。');
          setLoading(false);
          return;
        }

        let googleData: GoogleSearchResponse = {};
        try {
          googleData = await googleRes.json();
        } catch (err) {
          console.error('GoogleレスポンスがJSONでない:', err);
          setError('Google検索のレスポンス解析に失敗しました。');
          setLoading(false);
          return;
        }
        const googleItems: Array<{ title?: string; snippet?: string }> = googleData.items || [];

        // 2) GPTで候補タイトル抽出（/api/extract-titles）
        const extractRes = await fetch('/api/extract-titles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: googleItems, originalQuery: queryText }),
        });

        if (!extractRes.ok) {
          console.error('extract-titles APIエラー:', extractRes.status);
          setError('GPTで候補抽出に失敗しました。');
          setLoading(false);
          return;
        }

        let extracted: ExtractedTitles = {};
        try {
          extracted = await extractRes.json();
        } catch (err) {
          console.error('extract-titles レスポンスがJSONでない:', err);
          setError('GPTレスポンス解析に失敗しました。');
          setLoading(false);
          return;
        }

        const titlesJa: string[] = Array.isArray(extracted.titlesJa) ? extracted.titlesJa : [];
        const titlesEn: string[] = Array.isArray(extracted.titlesEn) ? extracted.titlesEn : [];

        // 3) 候補生成（重複除去 & クリーニング）
        let candidates: string[] = Array.from(
          new Set(
            [...titlesJa, ...titlesEn]
              .map((t) => (t || '').trim())
              .filter(Boolean)
              .map((t) => t.replace(/\s{2,}/g, ' '))
          )
        );

        // フォールバック：Google結果のタイトルからも候補を生成
        if (candidates.length === 0) {
          const fromGoogle = googleItems
            .map((it) => (it.title || '').trim())
            .filter(Boolean)
            .map((t) =>
              t
                .replace(/[-–—|｜:].*$/, '')
                .replace(/\(\d{4}\)/, '')
                .trim()
            );
          candidates = Array.from(new Set(fromGoogle)).slice(0, 10);
        }

        if (candidates.length === 0) {
          setError('候補が見つかりませんでした。キーワードを変えて再検索してください。');
          setLoading(false);
          return;
        }

        // 4) 候補をTMDBで検索して集約
        const allResults: MovieData[] = [];
        for (const title of candidates) {
          const tmdbResults = await searchTMDBBoth(title, 5);
          allResults.push(...tmdbResults);
        }

        // 重複除去
        const uniqueResults = Array.from(new Map(allResults.map((m) => [m.id, m])).values());

        // 5) overview スコアで並べ替え（キーワード一致個数）
        const qNorm = normalizeTitle(queryText);
        const queryKeywords = qNorm.split(' ').filter(Boolean);

        movieCandidates = uniqueResults
          .map((m) => {
            const overviewNorm = normalizeTitle(m.overview || '');
            const matchCount = queryKeywords.filter((kw) => overviewNorm.includes(kw)).length;
            const overviewScore = matchCount >= 3 ? 3 : matchCount === 2 ? 2 : matchCount === 1 ? 1 : 0;
            return { item: m, score: overviewScore };
          })
          .sort((a, b) => b.score - a.score)
          .map((x) => x.item);
      }

      // ========= 視聴サービス情報付加 =========
      const withProviders = await Promise.all(
        movieCandidates.map(async (movie) => {
          try {
            // 概要が薄ければ英語詳細で補完
            if (!movie.overview || movie.overview.length < 5) {
              const enDetailUrl = `${TMDB_BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=en-US`;
              const enDetailRes = await fetch(enDetailUrl);
              if (enDetailRes.ok) {
                const enData: MovieData = await enDetailRes.json();
                movie.overview = enData.overview || movie.overview;
              }
            }

            // 視聴プロバイダ
            const providersUrl = `${TMDB_BASE_URL}/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`;
            const provRes = await fetch(providersUrl);
            const services: { name: string; logo: string; link?: string }[] = [];
            let justWatchLink: string | undefined;

            if (provRes.ok) {
              const providersData: {
                results?: { JP?: { link?: string; flatrate?: Provider[]; buy?: Provider[]; rent?: Provider[] } };
              } = await provRes.json();
              const jpProviders = providersData.results?.JP;
              justWatchLink = jpProviders?.link;

              const add = (list?: Provider[]) =>
                list?.forEach((p) =>
                  services.push({
                    name: p.provider_name,
                    logo: p.logo_path,
                    link: getServiceSpecificLink(p.provider_name, movie.title, justWatchLink),
                  })
                );

              add(jpProviders?.flatrate);
              add(jpProviders?.buy);
              add(jpProviders?.rent);
            }

            return { ...movie, streamingServices: services, justWatchLink };
          } catch {
            return { ...movie, streamingServices: [], justWatchLink: undefined };
          }
        })
      );

      setResults(withProviders);
    } catch (err) {
      console.error(err);
      setError('検索中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-screen-lg mx-auto px-4 py-6">
      <h1 className="text-2xl sm:text-3xl text-center font-bold mb-4">どのオンデマンドで観れる？</h1>

      {/* 検索フォーム */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row justify-center gap-2 mb-4 px-2">
        <input
          type="text"
          value={movieTitle}
          onChange={(e) => setMovieTitle(e.target.value)}
          placeholder="映画名またはキーワードを入力してください"
          className="p-2 border rounded-md flex-grow"
          disabled={loading}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md" disabled={loading}>
          {loading ? '検索中...' : '検索'}
        </button>
      </form>

      {/* モード切替 */}
      <div className="text-center mb-2">
        <label className="mr-4">
          <input
            type="radio"
            name="searchMode"
            value="title"
            checked={searchMode === 'title'}
            onChange={() => setSearchMode('title')}
          />
          タイトルで検索
        </label>
        <label>
          <input
            type="radio"
            name="searchMode"
            value="content"
            checked={searchMode === 'content'}
            onChange={() => setSearchMode('content')}
          />
          内容で検索
        </label>
      </div>

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      {/* 検索結果 */}
      {results.length > 0 && (
        <div className="space-y-8">
          <h2 className="text-xl font-semibold text-center">検索結果</h2>
          {results.map((movie) => {
            const posterUrl = tmdbImg(movie.poster_path, 'w200');
            return (
              <div key={movie.id} className="bg-white p-3 sm:p-4 rounded-lg shadow-md flex flex-col sm:flex-row gap-3">
                <div className="flex flex-col items-center">
                  {posterUrl ? (
                    <Image
                      src={posterUrl}
                      alt={movie.title}
                      width={100}
                      height={150}
                      className="rounded-md"
                    />
                  ) : (
                    <div className="w-[100px] h-[150px] bg-gray-200 rounded-md flex items-center justify-center text-xs text-gray-600">
                      No Image
                    </div>
                  )}
                  <button
                    onClick={() => router.push(`/chat/${movie.id}`)}
                    className="mt-2 bg-blue-600 text-white px-3 py-1 rounded-md w-full"
                  >
                    この映画について語る
                  </button>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold">
                    {movie.title}（{movie.release_date?.slice(0, 4)}）
                  </h3>
                  <p className="text-sm text-gray-700 mb-2">{movie.overview?.slice(0, 200)}...</p>

                  <div>
                    <strong className="block mb-1">視聴可能サービス：</strong>
                    {movie.streamingServices?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {movie.streamingServices.map((s, i) => {
                          const logoUrl = tmdbImg(s.logo, 'w45');
                          if (!logoUrl) return null; // ロゴが無ければ描画しない
                          return (
                            <a key={i} href={s.link} target="_blank" rel="noopener noreferrer">
                              <Image
                                src={logoUrl}
                                alt={s.name}
                                width={30}
                                height={30}
                                className="rounded border"
                              />
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">現在、視聴可能なサービス情報は見つかりませんでした。</p>
                    )}

                    <a
                      href={`https://www.amazon.co.jp/s?k=${encodeURIComponent(movie.title + ' DVD')}&i=dvd&tag=tetsugakuman-22`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <button className="mt-2 bg-yellow-400 text-black text-sm rounded-md w-full py-1">
                        DVDを探す
                      </button>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 最新の書き込み */}
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
                <li key={index} className="flex flex-col sm:flex-row sm:items-center border-b pb-2 gap-1 sm:gap-2 w-full">
  <Link href={`/?title=${encodeURIComponent(comment.movieTitle)}`} className="sm:max-w-[30%] w-full break-words">
    <span className="text-blue-600 underline cursor-pointer">{comment.movieTitle}</span>
  </Link>
  <Link href={`/chat/${comment.movieId}`} className="sm:max-w-[60%] w-full break-words">
    <span className="text-sm cursor-pointer">{comment.text}</span>
  </Link>
  <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap sm:max-w-[10%] text-right">{date}</span>
</li>

              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <SearchContent />
    </Suspense>
  );
}
