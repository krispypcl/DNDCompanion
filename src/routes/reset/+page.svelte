<script lang="ts">
  import { base } from '#lib/base.ts';
  import AuthForm from '#lib/components/AuthForm.svelte';
  import { requestReset } from '#lib/data/session.ts';
</script>

<svelte:head><title>Reset your password | DND Companion</title></svelte:head>

<AuthForm
  title="Reset your password"
  name="Reset your password"
  submitLabel="Send Reset Link"
  fields={[{ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' }]}
  onsubmit={async (v) => {
    await requestReset(v.email, `${location.origin}${base}/login`);
    return 'If that address has an account, a reset link is on its way.';
  }}
>
  <a class="smallbtn" href="{base}/login">Back to Sign In</a>
</AuthForm>
