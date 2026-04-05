import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 浏览器必须用 `createBrowserClient`，session 写入 Cookie，middleware 才能识别。
 * 服务端（RSC 等）仍用 `createClient`，行为与原先一致；需带登录态的 Server 请求请用 `createSupabaseServerClient`。
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let browserClient: SupabaseClient | undefined;
let serverClient: SupabaseClient | undefined;

function getSupabase(): SupabaseClient {
  if (typeof window !== "undefined") {
    browserClient ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
    return browserClient;
  }
  serverClient ??= createClient(supabaseUrl, supabaseAnonKey);
  return serverClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
