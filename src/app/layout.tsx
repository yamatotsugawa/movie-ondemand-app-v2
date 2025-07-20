import './globals.css'; // グローバルCSSファイルをインポート
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '映画ストリーミング検索アプリ', // アプリケーションのタイトル
  description: '映画のストリーミングサービスを検索できるアプリ', // アプリケーションの説明
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}