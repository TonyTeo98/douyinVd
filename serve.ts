import { getVideoUrl, getVideoInfo } from "./douyin.ts";

/**
 * 创建一个标准的CORS头。
 * @returns {Headers} 一个包含CORS属性的Headers对象。
 */
const createCorsHeaders = (): Headers => {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // 允许浏览器发送 Range 请求头，这是视频拖动播放的关键
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  // 允许浏览器读取 Content-Length 等头信息
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
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
  
  // 处理获取元数据的请求 (如果您的前端需要)
  if (url.searchParams.has("data")) {
      try {
        const videoInfo = await getVideoInfo(inputUrl);
        corsHeaders.set('Content-Type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(videoInfo), { headers: corsHeaders });
      } catch (error) {
        console.error("Error fetching video info:", error);
        return new Response("Error fetching video info.", { status: 500, headers: corsHeaders });
      }
  }

  // --- 主要的视频代理逻辑 ---
  try {
    // 1. 从 douyin.ts 获取受保护的视频URL
    const protectedVideoUrl = await getVideoUrl(inputUrl);
    if (!protectedVideoUrl) throw new Error("Could not resolve video URL.");

    // 2. 在服务器端伪装成抖音官网去请求视频
    // 注意：我们将浏览器的Range头也转发过去，以支持视频拖动
    const videoRequestHeaders = new Headers();
    videoRequestHeaders.set('Referer', 'https://www.douyin.com/');
    videoRequestHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');
    if (req.headers.has('range')) {
        videoRequestHeaders.set('Range', req.headers.get('range')!);
    }

    const videoResponse = await fetch(protectedVideoUrl, { headers: videoRequestHeaders });

    if (!videoResponse.ok || !videoResponse.body) {
      throw new Error(`Upstream server error: ${videoResponse.status} ${videoResponse.statusText}`);
    }
    
    // 3. 将视频流和重要的头信息转发给前端
    // 从视频源响应中复制重要的头信息
    const responseHeaders = createCorsHeaders();
    responseHeaders.set('Content-Type', videoResponse.headers.get('Content-Type') || 'video/mp4');
    responseHeaders.set('Content-Length', videoResponse.headers.get('Content-Length') || '0');
    responseHeaders.set('Accept-Ranges', 'bytes');
    if (videoResponse.headers.has('content-range')) {
        responseHeaders.set('Content-Range', videoResponse.headers.get('content-range')!);
    }

    // 将视频流(videoResponse.body)直接作为响应返回给前端浏览器
    // 同时传递原始的状态码，例如 206 Partial Content
    return new Response(videoResponse.body, {
        status: videoResponse.status,
        headers: responseHeaders
    });

  } catch (error) {
    console.error(`Error proxying request for URL "${inputUrl}":`, error);
    return new Response("An internal server error occurred while proxying video.", { status: 500, headers: corsHeaders });
  }
};

export { handler };
