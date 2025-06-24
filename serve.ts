import { getVideoUrl, getVideoInfo } from "./douyin.ts";

/**
 * 创建一个标准的CORS头。
 * @returns {Headers} 一个包含CORS属性的Headers对象。
 */
const createCorsHeaders = (): Headers => {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
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
    return new Response("Missing 'url' parameter.", { status: 400, headers: corsHeaders });
  }

  try {
    // 无论请求类型如何，都先获取完整信息以判断内容类型
    const data = await getVideoInfo(inputUrl);

    // 如果客户端明确要求元数据 (data=true)，则返回JSON
    if (url.searchParams.has("data")) {
      corsHeaders.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // --- 媒体代理逻辑 (当请求没有 &data=true 时) ---
    if (data.type === 'video' && data.video_url) {
      // 确认是视频，则代理视频流
      const videoRequestHeaders = new Headers();
      videoRequestHeaders.set('Referer', 'https://www.douyin.com/');
      videoRequestHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');
      if (req.headers.has('range')) {
        videoRequestHeaders.set('Range', req.headers.get('range')!);
      }

      const videoResponse = await fetch(data.video_url, { headers: videoRequestHeaders });

      if (!videoResponse.ok || !videoResponse.body) {
        throw new Error(`无法从源服务器获取视频流: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      const responseHeaders = createCorsHeaders();
      responseHeaders.set('Content-Type', videoResponse.headers.get('Content-Type') || 'video/mp4');
      responseHeaders.set('Content-Length', videoResponse.headers.get('Content-Length') || '0');
      responseHeaders.set('Accept-Ranges', 'bytes');
      if (videoResponse.headers.has('content-range')) {
        responseHeaders.set('Content-Range', videoResponse.headers.get('content-range')!);
      }

      return new Response(videoResponse.body, { status: videoResponse.status, headers: responseHeaders });

    } else if (data.type === 'img') {
      // 如果是图文，媒体代理接口不应被调用。
      // 返回一个错误，提示前端应使用元数据接口中的图片链接。
      return new Response("这是一个图文帖子。请使用带有 '&data=true' 的接口来获取图片链接。", { status: 400, headers: corsHeaders });
    } else {
      throw new Error("未知或不支持的内容类型。");
    }

  } catch (error) {
    console.error(`处理请求时发生错误 URL "${inputUrl}":`, error);
    return new Response("服务器在处理请求时发生内部错误。", { status: 500, headers: corsHeaders });
  }
};

export { handler };
