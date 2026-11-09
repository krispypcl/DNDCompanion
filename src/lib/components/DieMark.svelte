<script lang="ts">
  /**
   * The sign that a value rolls: a small d20 beside its title (a skill's
   * name, a column's heading, "Initiative"). Dim at rest; a hover over the
   * thing that rolls lights it (`.rolls-hover:hover .diemark` in app.css).
   */
  let { label = 'Rolls in the dice tray' }: { label?: string } = $props();
</script>

<svg class="diemark" viewBox="0 0 24 24" role="img" aria-label={label}><title>{label}</title><path d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4zM12 7.5l4.3 7.4H7.7zM12 2.5v5M20.5 7.4l-4.2 7.5M3.5 7.4l4.2 7.5M7.7 14.9 3.5 16.6M16.3 14.9l4.2 1.7M7.7 14.9 12 21.5l4.3-6.6" /></svg>
