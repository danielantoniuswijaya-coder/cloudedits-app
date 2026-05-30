# Security Specification - CloudEdits Firestore Rules (Security TDD)

This document establishes the declarative security invariants of the CloudEdits platform, lists twelve "Dirty Dozen" attack vectors, and defines how the Firestore ruleset blocks them.

## 1. Data Invariants

1. **User Ownership & Role integrity**: A user cannot modify their own profile's role or subscription once registered, to prevent client-side elevation to Editor or and unauthorized plan changes.
2. **Project Visibility**: Clients must only see projects they own (`ownerId == request.auth.uid`). Editors can see projects they are assigned to (`editorId == request.auth.uid`) or projects that are pending an editor.
3. **Status Transitions & Lifecycle**: Only editors can transition projects from `Pending` -> `Editing` -> `Revision` -> `Completed`. Clients can only request revisions or set status to completed upon approval.
4. **Revision Isolation**: A revision can only be added to a project if the client is the project owner or the editor is the assigned editor.

---

## 2. The "Dirty Dozen" Malicious Payloads

We define 12 malicious client operations designed to spoof identities or skip states, and verify how they are caught.

### Payload 1: Role Escalation on Profile Creation
*   **Attack**: Client registers and sets `role` to `Editor` and `subscription` to `Agency` for free.
*   **Response**: Firestore rules validate that on document creation or update, a new profile must match the user's role and default schema, preventing self-assigned permissions.

### Payload 2: Spoofing ownerId in Project Creation
*   **Attack**: User constructs a payload where `ownerId` is someone else's UID.
*   **Response**: `ownerId` must strictly equal `request.auth.uid`.

### Payload 3: Editor Hijacks Project Access
*   **Attack**: Editor tries to read a project owned by Client B without being assigned as the project editor.
*   **Response**: Allow check limits reads to `resource.data.ownerId == request.auth.uid || resource.data.editorId == request.auth.uid || (resource.data.status == 'Pending' && request.auth.uid != null)`.

### Payload 4: Client Arbitrarily Assigns Any Editor
*   **Attack**: A client specifies an editor in their budget plan who did not accept or registers a random UID.
*   **Response**: Assigning is validated when projects are claimed or edited by authorized roles.

### Payload 5: Spoofing Revision User ID
*   **Attack**: Client leaves a comment but injects the Editor's `userId` and `userRole` inside the comment payload.
*   **Response**: `incoming().userId == request.auth.uid` is strictly enforced.

### Payload 6: Mutating Closed Project States
*   **Attack**: Attempt to update details of a project whose status is `Completed`.
*   **Response**: Terminal status locking rules prevent updates on completed projects.

### Payload 7: Deleting Client Projects
*   **Attack**: An editor or third-party attempts to delete a project to clean historical evidence.
*   **Response**: Deletion is disallowed unless explicitly permitted (or restricted to nobody for safety).

### Payload 8: Corrupting Metadata with Giant Strings
*   **Attack**: Injecting a 2MB JSON string into the `name` or `timestamp` field.
*   **Response**: Strict checking with `.size() < 100` and `.size() < 10` on target keys.

### Payload 9: Client Modifies system-generated subscriptionType
*   **Attack**: Client modifies their project's `subscriptionType` from `Starter` to `Agency` on an existing project.
*   **Response**: System fields are marked immutable during update.

### Payload 10: Injecting "Ghost Fields" into Revisions
*   **Attack**: Under `revisions/{revisionId}`, client inserts a field called `isVerifiedBySystem: true`.
*   **Response**: `.keys().hasOnly()` or complete validations in `isValidRevision` block the write.

### Payload 11: Attempting to Add Revision to Another client's Projects
*   **Attack**: Client attempts to create a comment inside `/projects/someProj/revisions/rev1` but they don't own `someProj`.
*   **Response**: Master Gate pattern fetches project under `/projects/someProj` and verifies the auth user UID matches `ownerId` or `editorId`.

### Payload 12: Spoofing UpdatedAt timestamp
*   **Attack**: Client sets `updatedAt` to an arbitrary timestamp in the past.
*   **Response**: `incoming().updatedAt == request.time` ensures strict temporal verification.
