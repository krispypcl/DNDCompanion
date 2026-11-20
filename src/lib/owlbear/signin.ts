/**
 * Signing in with Google or Discord from inside Owlbear Rodeo.
 *
 * The panel lives in a frame on owlbear.rodeo, with storage of its own, and
 * Google and Discord refuse to be shown in a frame. So the sign-in happens in
 * a small window of its own, and only a one-time code comes back:
 *
 * 1. The panel starts a PKCE sign-in with a client of its own (its secret,
 *    the code verifier, stays in the panel's storage) and opens the
 *    service's page in a new window, asking it to come back to
 *    /owlbear/signin with a random name for this one sign-in.
 * 2. That page (top level, where Google and Discord are happy) sends the
 *    code it was given to the panel over a Supabase Realtime broadcast on
 *    that random name, then closes.
 * 3. The panel trades the code, with its verifier, for a session, and hands
 *    the session to the app's own client.
 *
 * The code is worthless without the verifier, which never leaves the panel,
 * and the channel's name can't be guessed; nothing is stored on the way.
 * The window can't simply post back to the panel: the services' pages cut
 * the link between a window and the frame that opened it.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { base } from '#lib/base.ts';
import { supabase, supabaseKey, supabaseUrl } from '#lib/supabase.ts';
import { PROVIDER_NAMES, type OAuthProvider } from '#lib/data/session.ts';

export const SIGNIN_EVENT = 'code';
export const signinChannel = (nonce: string) => `dndc-signin:${nonce}`;
const PKCE_STORAGE = 'dndc-owlbear-pkce';

let pkce: SupabaseClient | null = null;
/** A client of its own for the PKCE sign-in: it keeps no session (the app's client does). */
function pkceClient(): SupabaseClient {
  pkce ??= createClient(supabaseUrl, supabaseKey, {
    auth: { flowType: 'pkce', storageKey: PKCE_STORAGE, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return pkce;
}
/** The PKCE client must not hold on to the session: two clients refreshing one session would fight. */
function forgetPkceSession() {
  try {
    for (const k of Object.keys(localStorage)) if (k === PKCE_STORAGE || k.startsWith(`${PKCE_STORAGE}-user`)) localStorage.removeItem(k);
  } catch {
    // Storage blocked: nothing was kept either.
  }
}

/**
 * Signs in with a service from inside Owlbear. Call it straight from a press
 * (browsers only let a press open a window). Resolves once signed in.
 */
export async function signInFromOwlbear(provider: OAuthProvider): Promise<void> {
  const name = PROVIDER_NAMES[provider];
  // Opened at once, while the press still counts; given its address below.
  const popup = window.open('', 'dndc-signin', 'popup,width=520,height=720');
  if (!popup) throw new Error(`Your browser stopped the ${name} window! Allow pop-ups for owlbear.rodeo and try again.`);
  const nonce = crypto.randomUUID();
  const back = `${location.origin}${base}/owlbear/signin?n=${encodeURIComponent(nonce)}`;

  // Listening before the window opens, so the code can't arrive unheard.
  let stop = () => {};
  const code = new Promise<{ code: string; flow?: string }>((resolve, reject) => {
    const channel = supabase
      .channel(signinChannel(nonce), { config: { broadcast: { self: false } } })
      .on('broadcast', { event: SIGNIN_EVENT }, ({ payload }) => {
        const p = payload as { code?: unknown; flow?: unknown; error?: unknown };
        if (typeof p.error === 'string') reject(new Error(`${name} said no: ${p.error}`));
        else if (typeof p.code === 'string') resolve({ code: p.code, flow: typeof p.flow === 'string' ? p.flow : undefined });
      })
      .subscribe();
    const watch = setInterval(() => {
      if (popup.closed) {
        clearInterval(watch);
        // A moment's grace: the code may be on its way as the window closes.
        setTimeout(() => reject(new Error(`The ${name} window closed before you were signed in. Try again!`)), 4000);
      }
    }, 600);
    const giveUp = setTimeout(() => reject(new Error(`${name} took too long! Try again.`)), 5 * 60_000);
    stop = () => {
      clearInterval(watch);
      clearTimeout(giveUp);
      void supabase.removeChannel(channel);
    };
  });

  try {
    const { data, error } = await pkceClient().auth.signInWithOAuth({ provider, options: { redirectTo: back, skipBrowserRedirect: true } });
    if (error || !data?.url) throw new Error(error?.message || `${name} didn’t answer! Try again.`);
    popup.location.href = data.url;
    const got = await code;
    const traded = await pkceClient().auth.exchangeCodeForSession(got.code, got.flow ? { flowId: got.flow } : undefined);
    if (traded.error || !traded.data.session) throw new Error(traded.error?.message || 'That sign-in didn’t take! Try again.');
    const { access_token, refresh_token } = traded.data.session;
    const set = await supabase.auth.setSession({ access_token, refresh_token });
    if (set.error) throw new Error(set.error.message);
  } catch (e) {
    if (!popup.closed) popup.close();
    throw e;
  } finally {
    stop();
    forgetPkceSession();
  }
}
