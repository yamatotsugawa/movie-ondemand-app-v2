// src/app/api/search/route.ts
// Next.jsのApp RouterにおけるAPIルートです。
// このファイルは、クライアントサイドからの映画検索リクエストを受け取り、
// TMDB APIを呼び出して映画情報と視聴可能なストリーミングサービス情報を返します。

import { NextRequest, NextResponse } from 'next/server';

// 環境変数からTMDB APIキーを取得します。
// サーバーサイドのコードなので、NEXT_PUBLIC_ プレフィックスは不要です。
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY; // .env.localにTMDB_API_KEY=YOUR_KEYを設定してください

// TMDB APIからの映画データのインターフェース
interface TmdbMovieData {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  // 他にも多くのプロパティがありますが、ここでは必要なもののみ定義
}

// TMDB APIからのプロバイダー情報のインターフェース
interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

// TMDB APIからの視聴プロバイダーレスポンスのインターフェース
interface TmdbWatchProvidersResponse {
  id: number;
  results?: {
    JP?: { // 日本のプロバイダー情報
      link?: string;
      flatrate?: TmdbProvider[]; // サブスクリプション
      buy?: TmdbProvider[];      // 購入
      rent?: TmdbProvider[];     // レンタル
      ads?: TmdbProvider[];      // 広告付き無料
      free?: TmdbProvider[];     // 無料
    };
    // 他の国も含まれる可能性がありますが、JPのみに絞ります
  };
}

// アプリケーションで使用する映画結果のインターフェース
interface AppMovieResult {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  streamingServices?: { name: string; logo: string; link?: string }[];
  justWatchLink?: string;
}

// プロバイダー名に基づいてサービス固有のリンクを生成するヘルパー関数
// この関数はクライアントサイドのHomeコンポーネントにもありますが、APIルートでも再利用します。
const getServiceSpecificLink = (providerName: string, movieTitle: string, justWatchMovieLink?: string): string => {
  switch (providerName) {
    case 'Amazon Prime Video':
      return `https://www.amazon.co.jp/s?k=${encodeURIComponent(movieTitle)}&i=instant-video`;
    case 'Netflix':
      return 'https://www.netflix.com/jp/';
    case 'U-NEXT':
      return 'https://video.unext.jp/';
    case 'Hulu':
      return 'https://www.hulu.jp/';
    case 'Disney Plus':
      return 'https://www.disneyplus.com/ja-jp';
    case 'Apple TV':
      return `https://tv.apple.com/jp/search/${encodeURIComponent(movieTitle)}`;
    case 'Google Play Movies':
      return `https://play.google.com/store/search?q=${encodeURIComponent(movieTitle)}&c=movies`;
    case 'YouTube':
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(movieTitle)}+full+movie`;
    default:
      return justWatchMovieLink || '#'; // デフォルトはJustWatchリンク、または#
  }
};

// GETリクエストを処理する関数
export async function GET(request: NextRequest) {
  // URLから検索クエリパラメータを取得します
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  // クエリが提供されていない場合はエラーを返します
  if (!query) {
    return NextResponse.json({ error: '映画名を入力してください。' }, { status: 400 });
  }

  // APIキーが設定されていない場合はエラーを返します
  if (!TMDB_API_KEY) {
    return NextResponse.json({ error: 'APIキーが設定されていません。`.env.local`を確認してください。' }, { status: 500 });
  }

  try {
    // 1. 映画を検索するためのTMDB APIエンドポイント
    const searchUrl = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB_API_KEY}&language=ja-JP`;
    const searchResponse = await fetch(searchUrl);

    // 検索リクエストが失敗した場合はエラーをスローします
    if (!searchResponse.ok) {
      throw new Error(`映画検索に失敗しました: ${searchResponse.statusText}`);
    }

    // 検索結果をJSONとしてパースします
    const searchData: { results: TmdbMovieData[] } = await searchResponse.json();

    // 検索結果がある場合のみ処理を進めます
    if (searchData.results && searchData.results.length > 0) {
      // 各映画についてストリーミングサービス情報を並行して取得します
      const moviesWithStreaming = await Promise.all(
        searchData.results.map(async (movie) => {
          let services: { name: string; logo: string; link?: string }[] = [];
          let justWatchLink: string | undefined = undefined;

          try {
            // 2. 映画の視聴プロバイダーを取得するためのTMDB APIエンドポイント
            const providersUrl = `${TMDB_BASE_URL}/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`;
            const providersResponse = await fetch(providersUrl);

            if (providersResponse.ok) {
              const providersData: TmdbWatchProvidersResponse = await providersResponse.json();
              const jpProviders = providersData.results?.JP; // 日本のプロバイダー情報に絞る

              justWatchLink = jpProviders?.link; // JustWatchの共通リンク

              // 各プロバイダータイプ（サブスク、購入、レンタル）のサービスを追加するヘルパー関数
              const addServices = (providerList: TmdbProvider[] | undefined) => {
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

              // 各タイプのプロバイダーを追加
              addServices(jpProviders?.flatrate);
              addServices(jpProviders?.buy);
              addServices(jpProviders?.rent);
              addServices(jpProviders?.ads); // 広告付き無料
              addServices(jpProviders?.free); // 無料

              // サービス名をキーとして重複を排除し、ユニークなサービスリストを作成
              services = Array.from(new Map(services.map((item) => [item.name, item])).values());
            }
          } catch (providerError) {
            console.error(`映画ID ${movie.id} のプロバイダー取得中にエラーが発生しました:`, providerError);
            // プロバイダー取得に失敗しても、映画情報自体は返す
          }

          // アプリケーションで使用する形式で映画データを返します
          return {
            id: movie.id,
            title: movie.title,
            release_date: movie.release_date,
            overview: movie.overview,
            poster_path: movie.poster_path,
            streamingServices: services,
            justWatchLink: justWatchLink,
          };
        })
      );
      // 成功した場合は、結果をJSON形式で返します
      return NextResponse.json(moviesWithStreaming, { status: 200 });

    } else {
      // 映画が見つからなかった場合は、空の配列を返します
      return NextResponse.json([], { status: 200 });
    }

  } catch (err) {
    // エラーが発生した場合は、エラーメッセージをJSON形式で返します
    console.error("API Route Error:", err);
    let errorMessage = '予期せぬエラーが発生しました';
    if (err instanceof Error) {
      errorMessage = `検索中にエラーが発生しました: ${err.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
