/**
 * A phone's pull to refresh (PullRefresh), shared with the top bar
 * (PhoneTop), whose dice does the pull's turning and spinning.
 */
class Pull {
  /** How far the page is pulled down, in pixels. */
  offset = $state(0);
  /** A finger is pulling now: the page follows it without easing. */
  pulling = $state(false);
  /** Far enough that letting go refreshes. */
  ready = $state(false);
  /** Let go past it: the page is on its way to reloading. */
  refreshing = $state(false);
  /** How many top bars are on the page to show it (with none, the pull shows its own dice). */
  hosts = $state(0);
}

export const pull = new Pull();
