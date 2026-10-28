<script lang="ts">
  import { base } from '$app/paths';
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { signUp } from '$lib/data/session';
</script>

<AuthForm
  title="Create an account"
  submitLabel="Sign up"
  fields={[
    { id: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
    { id: 'password', label: 'Password', type: 'password', autocomplete: 'new-password' }
  ]}
  onsubmit={async (v) => {
    const redirect = `${location.origin}${base}/login`;
    await signUp(v.email, v.password, redirect);
    return 'Check your email to confirm the address, then sign in.';
  }}
>
  <a href="{base}/login">Already have an account</a>
</AuthForm>
