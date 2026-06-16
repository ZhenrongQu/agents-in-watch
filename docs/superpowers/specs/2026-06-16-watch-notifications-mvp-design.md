# Watch Notifications MVP Design

## Product Goal

Agents in Watch should alert the user when a new pending agent request appears, so the user does not need to keep the Watch app open or manually refresh to notice that Claude Code needs attention.

## Scope

This MVP adds local notification scheduling from the iPhone companion side when newly loaded pending requests appear. The notification points the user back to the iPhone or Watch app to review and respond. It does not add notification action buttons, background retry queues, push notifications, or guaranteed background delivery.

## User Experience

When the companion app loads pending requests and sees a request id it has not notified before, it schedules one local notification. The notification title uses the request title, and the body uses the watch summary. Existing pending requests loaded again should not notify repeatedly. Once a request disappears and later returns as a new id, it is eligible for a new notification.

The app should expose a compact notification permission status in the iPhone request list so users can tell whether alerts are ready, denied, or unavailable in the current environment.

## Architecture

Add a `NotificationBridge` protocol to `AgentsInWatchMobileUI`. `CompanionViewModel` depends on this protocol, not directly on `UNUserNotificationCenter`. A `UserNotificationBridge` implementation wraps UserNotifications on Apple platforms that support it, while tests use a fake bridge.

The ViewModel tracks notified request ids in memory and asks the notification bridge to notify only for newly discovered pending requests. This keeps the first version local and predictable.

## Testing

Unit tests should verify:

- `CompanionViewModel` requests notification authorization during initialization.
- Loading the first pending request schedules exactly one notification.
- Refreshing the same pending request does not schedule another notification.
- Loading a different request schedules a second notification.

System notification delivery still requires manual full-Xcode/device verification later because this machine only has Command Line Tools active.

## References

- Apple UserNotifications framework: `UNUserNotificationCenter`, `UNNotificationRequest`, and `UNMutableNotificationContent`.
