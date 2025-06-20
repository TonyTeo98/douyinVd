import { getVideoUrl, getVideoInfo } from "./douyin.ts";

/**
 * 创建一个标准的CORS头。
 * @returns {Headers} 一个包含CORS属性的Headers对象。
 */
const createCorsHeaders = (): Headers => {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return headers;
};

/**
 * 处理传入的HTTP请求。
 * @param {Request} req 传入的请求对象。
 * @returns {Promise<Response>} 一个解析为Response对象的Promise。
 */
const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = createCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const inputUrl = url.searchParams.get("url");

  if (!inputUrl) {
    corsHeaders.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response("Missing 'url' parameter.", { status: 400, headers: corsHeaders });
  }

  try {
    if (url.searchParams.has("data")) {
      const videoInfo = await getVideoInfo(inputUrl);
      corsHeaders.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(videoInfo), { headers: corsHeaders });
    }
    
    const videoUrl = await getVideoUrl(inputUrl);
    corsHeaders.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response(videoUrl, { headers: corsHeaders });

  } catch (error) {
    console.error(`Error processing request for URL "${inputUrl}":`, error);
    corsHeaders.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response("An internal server error occurred.", { status: 500, headers: corsHeaders });
  }
};

export { handler };
