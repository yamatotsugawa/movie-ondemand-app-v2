// /app/api/extract-titles/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export async function POST(req: Request) {
  try {
    if (!openai) {
      return NextResponse.json({ error: 'OPENAI_API_KEY missing' }, { status: 500 });
    }

    const { items, originalQuery } = await req.json();

    const systemPrompt = `
あなたは映画タイトル抽出の専門家です。
以下の検索結果から、クエリの内容に最も関連性が高い映画タイトルを抽出してください。

【出力ルール】
- JSON形式 {"titlesJa": [], "titlesEn": []} でのみ出力
- 邦題（日本語タイトル）と原題（英語タイトル）をそれぞれ3件以内
- タイトルに検索語が含まれるだけの無関係な映画は除外
- アニメ、TV番組、漫画、俳優名、シリーズ名だけの抽出は禁止
- 可能であれば邦題と原題をペアで出す
- 見つからない場合は空配列で返す
`;

    const userPrompt = `
クエリ: ${originalQuery}
検索結果: ${JSON.stringify(items, null, 2)}
`;

    // GPT呼び出し
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(resp.choices[0].message?.content || '{}');
    } catch (err) {
      console.warn('[extract-titles] JSON parse failed:', err);
      parsed = { titlesJa: [], titlesEn: [] };
    }

    // サーバー側フィルタリング（検索語との一致率）
    const validated = {
      titlesJa: validateResults(parsed.titlesJa || [], originalQuery),
      titlesEn: validateResults(parsed.titlesEn || [], originalQuery),
    };

    return NextResponse.json(validated);

  } catch (err) {
    console.error('[extract-titles] Error:', err);
    return NextResponse.json({ titlesJa: [], titlesEn: [] }, { status: 500 });
  }
}

function validateResults(titles: string[], query: string) {
  const keywords = extractKeywords(query);
  return titles.filter((title) => {
    const matchCount = keywords.filter((kw) =>
      title.toLowerCase().includes(kw.toLowerCase())
    ).length;
    return matchCount >= 1 || keywords.length <= 2; // キーワードが少ない場合は1つでも一致すればOK
  });
}

function extractKeywords(query: string) {
  return query
    .replace(/[。、！？・]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !['映画', 'こと', 'する'].includes(w));
}
