# Security Specification - AR Curator Collaborative

## Data Invariants
1. A Room must have an owner (the creator).
2. Items in a room can only be modified by signed-in users.
3. Participants can add/move/delete items in a room they have the ID for.
4. Item `instanceId` must match the document ID in the `items` subcollection.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Unauthenticated Write**: Create room without `auth`.
2. **Identity Spoofing**: Setting `ownerId` to another user's UID.
3. **Resource Poisoning**: Extremely large string for `roomId`.
4. **Invalid Type**: Setting `position.x` as a string.
5. **Orphaned Write**: Creating an item in a non-existent room.
6. **State Hijacking**: Updating `createdAt` timestamp.
7. **Cross-Room Infiltration**: Attempting to move an item to a different room via path manipulation.
8. **Shadow Field**: Adding `isVerified: true` to a room document.
9. **Zero-Trust Bypass**: Reading all rooms without a specific ID.
10. **Identity Integrity**: Updating an item's `updatedBy` to another user's UID.
11. **Resource Exhaustion**: Sending 1MB of junk in the `name` field.
12. **Terminal state lock (N/A for rooms yet)**: But let's assume we can't change room ownership.

## Tests to Implement
- `firestore.rules.test.ts` (conceptual)
