import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // ※NEXT_PUBLICではなくサーバー用のキーを使う
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // ChatGPTにキーワード抽出させる
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'あなたは映画検索のためのキーワード抽出アシスタントです。入力された文章を映画検索用のキーワードに分解してください。出力はカンマ区切りのキーワードのみ返してください。',
        },
        {
          role: 'user',
          content: text,
        },
      ],
    });

    const keywords = response.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('translate API error:', error);
    return NextResponse.json({ error: '翻訳APIエラー' }, { status: 500 });
  }
}
