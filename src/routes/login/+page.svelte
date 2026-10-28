<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { signIn } from '$lib/data/session';
</script>

<AuthForm
  title="Sign in"
  submitLabel="Sign in"
  fields={[
    { id: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
    { id: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' }
  ]}
  onsubmit={async (v) => {
    await signIn(v.email, v.password);
    await goto(`${base}/`);
  }}
>
  <a href="{base}/signup">Create an account</a>
  <a href="{base}/reset">Forgot password</a>
</AuthForm>
