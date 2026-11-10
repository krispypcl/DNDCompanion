<script lang="ts">
  import { base } from '$app/paths';
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { signUp } from '$lib/data/session';
  import { passwordStrength } from '$lib/rules/password';

  /** Supabase accepts six; a typo here means a locked-out account, so ask for more. */
  const MIN_PASSWORD = 8;
</script>

<AuthForm
  google
  title="Create an account"
  name="Create an account"
  submitLabel="Sign up"
  fields={[
    { id: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
    { id: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', minlength: MIN_PASSWORD, strength: true },
    { id: 'confirm', label: 'Confirm password', type: 'password', autocomplete: 'new-password' }
  ]}
  validate={(v) => {
    if ((v.password ?? '').length < MIN_PASSWORD) {
      return `That password is a bit short! Use at least ${MIN_PASSWORD} characters.`;
    }
    if (passwordStrength(v.password ?? '', v.email ?? '').score === 0) {
      return 'Even a goblin could guess that password! Try a longer one, or a few unrelated words.';
    }
    if (v.password !== v.confirm) return 'Those two passwords don’t match! Type them again.';
    return null;
  }}
  onsubmit={async (v) => {
    const redirect = `${location.origin}${base}/login`;
    await signUp(v.email, v.password, redirect);
    return 'Check your email to confirm the address, then sign in.';
  }}
>
  <a class="smallbtn" href="{base}/login">Already have an account</a>
</AuthForm>
