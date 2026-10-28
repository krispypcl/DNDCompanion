<script lang="ts">
  import { base } from '$app/paths';
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { requestReset } from '$lib/data/session';
</script>

<AuthForm
  title="Reset your password"
  name="Reset your password"
  submitLabel="Send reset link"
  fields={[{ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' }]}
  onsubmit={async (v) => {
    await requestReset(v.email, `${location.origin}${base}/login`);
    return 'If that address has an account, a reset link is on its way.';
  }}
>
  <a href="{base}/login">Back to sign in</a>
</AuthForm>
