<script lang="ts">
  /**
   * The app's mark: a plain twenty-sided die, the shape of the hobby rather
   * than anyone's logo. The same drawing is the home-screen icon, the
   * favicon, the splash and the link preview (see static/ and app.html).
   */
  let { size = 40 }: { size?: number } = $props();
</script>

<svg class="logo" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
  <polygon points="24 3 43 14 43 34 24 45 5 34 5 14" fill="color-mix(in oklch, currentColor 6%, transparent)"
           stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
  <polygon points="24 12 34 29 14 29" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
  <path d="M24 12 24 3M24 12 43 14M24 12 5 14M34 29 43 14M34 29 43 34M34 29 24 45M14 29 24 45M14 29 5 34M14 29 5 14"
        fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.5" />
</svg>

<style>
  .logo { display: block; flex: none; }
</style>
