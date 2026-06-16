# Foreground Auto Refresh Design

## Product Goal

Agents in Watch should notice new pending requests while the iPhone companion app is open, without requiring the user to tap refresh repeatedly. This makes the existing local notification and Watch sync features useful during real Claude Code sessions.

## Scope

This MVP adds foreground-only automatic refresh. When the companion is connected to a helper, it starts a lightweight refresh loop. When the user disconnects, it stops. The loop does not run as a guaranteed background service and does not add iOS background tasks, push notifications, or retry queues.

## User Experience

The iPhone request list shows whether auto refresh is running and, when available, the last refresh time. Users can still pull to refresh or tap the manual refresh button. If auto refresh fails, the existing error message surface shows the helper/client error.

Default interval: 15 seconds. This is frequent enough for a coding-assistant approval flow while avoiding an aggressive local polling loop.

## Architecture

Add an `AutoRefreshDriver` protocol in `AgentsInWatchMobileUI`. `CompanionViewModel` depends on the protocol so tests can trigger refresh ticks manually. A default `TaskAutoRefreshDriver` runs an async loop and calls a handler every interval while active.

`CompanionViewModel` starts the driver when it enters `.connected`, stops it on disconnect, and updates a small `AutoRefreshStatus` value for the UI. The refresh tick calls the same pending-request load path used by manual refresh, so Watch publishing and local request notifications continue to use the existing code path.

## Testing

Unit tests should verify:

- Auto refresh starts when a saved credential restores a connected session.
- Auto refresh starts after pairing approval connects.
- A driver tick loads pending requests.
- Disconnect stops the driver and clears the auto-refresh status.

Full background behavior is intentionally out of scope.
