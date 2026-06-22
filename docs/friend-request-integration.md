# Friends feature — FE → backend wiring

The Flutter `lib/features/friends` BLoC is mock today. Connect each event to the
existing backend endpoint below (base path `/api/v1`). All require the Supabase
Bearer token.

| FE BLoC event | Method & path | Notes |
| --- | --- | --- |
| `SendFriendRequest(userId)` | `POST /profile/:userId/follow` | 201; public → instant follow, private → pending request |
| `LoadFriendRequests` | `GET /profile/follow-requests` | array of `FollowRequestView` |
| `AcceptFriendRequest(friendId)` | `PUT /profile/follow-requests/:friendId/accept` | `friendId` = requester's user id |
| `RejectFriendRequest(friendId)` | `PUT /profile/follow-requests/:friendId/reject` | |
| (cancel a sent request) | `DELETE /profile/:userId/follow` | unfollow also deletes a pending request |
| `LoadFriendSuggestions` | `GET /profile/suggestions` | array of `UserSuggestion` |
| (presence ping) | `POST /profile/me/heartbeat` | call ~every 60s while foregrounded |

## Mapping the `Friend` entity

The API returns a single `fullName`, not split names, and uses follow vocabulary:

| FE `Friend` field | Source |
| --- | --- |
| `firstName` / `lastName` | split client-side from `fullName` (or show `fullName` directly) |
| `profilePicture` | `avatarUrl` |
| `mutualFriends` | `mutualFriends` (requests) / `mutualCount` (suggestions) |
| `isOnline` | `isOnline` |
| `lastSeen` | `lastSeen` (ISO timestamp; `null` unless you follow the user — format client-side) |
| `id` | `requester.id` (requests) / `user.id` (suggestions) |
| (follow button state) | `isFollowing` (true once the viewer follows them) |

Presence is only present on the friend-request and suggestion responses, derived
from a 2-minute heartbeat window. `isOnline` is always returned, but the exact
`lastSeen` timestamp is disclosed only for users you follow (it is `null` for
suggested non-connections) to avoid leaking strangers' activity schedules.
