import { AuthClient } from '../tools/auth-build/node_modules/@supabase/auth-js/dist/module/index.js';
const config=window.Sync.publicApi();
export const auth=new AuthClient({url:config.url+'/auth/v1',headers:{apikey:config.anonKey},storageKey:'vp.guest-auth.v1.'+config.url,flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true});
