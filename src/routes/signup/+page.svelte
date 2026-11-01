<script lang="ts">
  import { base } from '$app/paths';
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { signUp } from '$lib/data/session';

  /** Supabase accepts six; a typo here means a locked-out account, so ask for more. */
  const MIN_PASSWORD = 8;
</script>

<AuthForm
  title="Create an account"
  name="Create an account"
  submitLabel="Sign up"
  fields={[
    { id: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
    { id: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', minlength: MIN_PASSWORD },
    { id: 'confirm', label: 'Confirm password', type: 'password', autocomplete: 'new-password' }
  ]}
  validate={(v) => {
    if ((v.password ?? '').length < MIN_PASSWORD) {
      return `Use at least ${MIN_PASSWORD} characters for the password.`;
    }
    if (v.password !== v.confirm) return 'The two passwords do not match.';
    return null;
  }}
  onsubmit={async (v) => {
    const redirect = `${location.origin}${base}/login`;
    await signUp(v.email, v.password, redirect);
    return 'Check your email to confirm the address, then sign in.';
  }}
>
  <a href="{base}/login">Already have an account</a>
</AuthForm>
