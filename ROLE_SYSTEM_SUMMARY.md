# User Role/Type System - Architecture Overview

## 1. Role Definition

### Database Schema
**File:** [database.sql](database.sql) (line 18)

User type is defined as an ENUM field in the `users` table:
```sql
type ENUM('admin', 'basic') NOT NULL DEFAULT 'basic'
```

### Two User Types:
- **`admin`** - Administrator account with elevated privileges
- **`basic`** - Regular user with standard permissions (default)

### Model Implementation
**File:** [server/models/User.model.js](server/models/User.model.js) (line 40)

When creating a user:
```javascript
static async create(userData) {
    const { username, email, password, type = "basic" } = userData;
    // type defaults to "basic" if not specified
}
```

---

## 2. Permission Checking - Backend

### Authentication Middleware
**File:** [server/middlewares/auth.middleware.js](server/middlewares/auth.middleware.js)

#### `authenticate` Middleware (lines 17-101)
- Verifies JWT token from Authorization header
- Extracts user info and attaches to `req.user` object:
  ```javascript
  req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      type: user.type,  // Stored in JWT payload
  };
  ```
- Logs unauthorized access attempts via AuditService

#### `isAdmin` Middleware (lines 110-138)
- **Checks:** `req.user.type !== "admin"`
- **Response:** 403 Forbidden if user is not admin
- Logs unauthorized admin attempts
- Used as route middleware for admin-only endpoints

### Service Layer - User Isolation
**File:** [server/services/Album.service.js](server/services/Album.service.js)

All services enforce user isolation with this pattern:
```javascript
static async getAll(requestUser) {
    const albums =
        requestUser.type === "admin"
            ? await AlbumModel.findAll()           // Admins see ALL albums
            : await AlbumModel.findAllByUserId(requestUser.id);  // Users see only their own
}
```

**Pattern used across all services:**
- If `requestUser.type === "admin"` → Access all data
- Otherwise → Filter data to user's own records only

### Admin-Only Routes
**File:** [server/routes/api/v1/logs.routes.js](server/routes/api/v1/logs.routes.js) (lines 1-7)

```javascript
router.use(authenticate, isAdmin);  // ALL logs routes require admin
// GET /api/v1/logs/today
// GET /api/v1/logs/dates
// GET /api/v1/logs
// GET /api/v1/logs/actions
// POST /api/v1/logs/actions
// PUT /api/v1/logs/actions/:id
// DELETE /api/v1/logs/actions/:id
```

**Logs endpoint protection:** All logging/audit endpoints restricted to admins only

---

## 3. Frontend - Permission-Based UI

### AuthContext Storage
**File:** [client/src/context/AuthContext.jsx](client/src/context/AuthContext.jsx) (lines 24-100)

User object stored in localStorage and state includes `type`:
```javascript
const userData = {
    id: user.id,
    username: user.username,
    email: user.email,
    type: user.type  // 'admin' or 'basic'
};
```

### Navigation Differences - Sidebar
**File:** [client/src/components/sidebar/Sidebar.jsx](client/src/components/sidebar/Sidebar.jsx) (lines 11-53, 87)

**Basic User Navigation:**
```javascript
const navItems = [
    { label: "Gallery", path: "/gallery" },
    { label: "Favourites", path: "/favourites" },
    { label: "Albums", path: "/albums" },
    { label: "Metadata", path: "/metadata" },
    { label: "Dashboard", path: "/dashboard" },
];
```

**Admin User Navigation (different items):**
```javascript
const adminNavItems = [
    { label: "Logs", path: "/logs" },
    { label: "Users", path: "/users" },
];
```

**Selection logic:**
```javascript
const sectionOneNavItems = user?.type === "admin" ? adminNavItems : navItems;
```

### UI Styling
**File:** [client/src/components/sidebar/Sidebar.jsx](client/src/components/sidebar/Sidebar.jsx) (lines 254, 257)

```jsx
<div className={`tagged-sidebar${user?.type === "admin" ? " tagged-sidebar--admin" : " tagged-sidebar--user"}`}>
    {user?.type === "admin" ? <p className="tagged-sidebar-admin-panel-label">ADMIN PANEL</p> : null}
</div>
```

Different CSS classes applied based on role for styling.

---

## 4. Feature Restrictions by Role

### Gallery/Media Pages
**Files:** [client/src/pages/gallerypage/GalleryPage.jsx](client/src/pages/gallerypage/GalleryPage.jsx), [MediaDetailPage.jsx](client/src/pages/gallerypage/MediaDetailPage.jsx)

**Admins cannot access:**
- Individual media detail pages (line 1483-1487)
- Album detail pages (line 1162-1167)
- Media editing functionality

**Check pattern:**
```javascript
if (user?.type === "admin") {
    return <h2>Media detail is not available for admin</h2>;
}
```

### Users Page - Role Filtering
**File:** [client/src/pages/userspage/UsersPage.jsx](client/src/pages/userspage/UsersPage.jsx)

**Admin-only features:**
- View all users list
- Filter users by role (Admin/Basic)
- Sidebar role filter buttons (lines 420-450)

**Role badge display:**
```javascript
const getRoleBadgeData = (type) => {
    if (type === "admin") {
        return { label: "A", title: "Admin", toneClass: "tagged-user-role-badge--admin" };
    }
    return { label: "B", title: "Basic", toneClass: "tagged-user-role-badge--basic" };
};
```

---

## 5. Permission Validation Flow

### Backend Request Flow
```
1. Incoming Request
   ↓
2. authenticate middleware
   - Validates JWT token
   - Extracts user info (including type)
   - Attaches req.user
   ↓
3. [Optional] isAdmin middleware (for admin-only routes)
   - Checks: req.user.type === "admin"
   - Returns 403 if not admin
   ↓
4. Controller receives request
   - Passes requestUser to service layer
   ↓
5. Service Layer
   - Checks requestUser.type === "admin"
   - If admin → Access all data
   - If basic → Filter to user's own data
   ↓
6. Response sent to client
```

### Frontend Check Pattern
```javascript
if (!user || user.type === "admin") {
    // Show admin-specific content or skip user-specific features
}

if (user?.type !== "admin" && someUserSpecificCheck) {
    // Apply restrictions for basic users
}
```

---

## 6. Key Files Reference

| File | Purpose |
|------|---------|
| [database.sql](database.sql) | User type ENUM definition |
| [server/middlewares/auth.middleware.js](server/middlewares/auth.middleware.js) | `authenticate` and `isAdmin` middlewares |
| [server/models/User.model.js](server/models/User.model.js) | User CRUD with type field |
| [server/services/Album.service.js](server/services/Album.service.js) | Example of service-layer filtering |
| [server/routes/api/v1/logs.routes.js](server/routes/api/v1/logs.routes.js) | Admin-only endpoint pattern |
| [client/src/context/AuthContext.jsx](client/src/context/AuthContext.jsx) | User data storage with type |
| [client/src/components/sidebar/Sidebar.jsx](client/src/components/sidebar/Sidebar.jsx) | Navigation based on role |
| [client/src/pages/userspage/UsersPage.jsx](client/src/pages/userspage/UsersPage.jsx) | Users management (admin-only) |
| [client/src/pages/gallerypage/*.jsx](client/src/pages/gallerypage/) | Media restrictions for admins |

---

## 7. Summary

The role system is a **simple binary model**:
- **Type stored in database:** `ENUM('admin', 'basic')`
- **Checked at:** Middleware (route protection), service layer (data filtering), frontend (UI rendering)
- **Admin privileges:**
  - Access all data regardless of owner
  - View Logs page
  - View Users page and manage user roles
  - See admin-specific sidebar menu
- **Basic user restrictions:**
  - Can only access their own media/albums
  - Cannot view logs or users list
  - Cannot access media/album detail pages in certain scenarios (to prevent confusion)
- **Enforcement:** Triple-layer validation (JWT token → isAdmin middleware → service-layer filtering)
