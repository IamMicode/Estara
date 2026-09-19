# ESTARA — MASTER APPLICATION BUILD PLAN & PROMPT
## From Cinematic Landing Page to Full Real-Estate Marketplace

Build the next complete stage of **Estara**, extending the existing cinematic landing-page project into a real, production-oriented real-estate marketplace.

This document is the master implementation prompt and architecture plan for the application stage.

IMPORTANT:
- Preserve the existing cinematic landing experience.
- Do not destroy or unnecessarily rewrite the existing Scenes 01–06.
- Connect the cinematic experience to the actual application.
- Build the application in logical phases internally, but complete the full scope in this document.
- Do not create fake functionality that only looks functional.
- Real forms must persist data.
- Real authentication must enforce permissions.
- Real property listings must be stored and retrieved from the database.
- Do not expose secrets in client-side code.
- Keep the application architecture clean enough for future production deployment.

---

# 1. ESTARA PRODUCT DEFINITION

Estara is a two-sided real-estate marketplace.

It connects:

**PROPERTY SEEKERS / CUSTOMERS**
with
**PROPERTY AGENTS / LISTERS**

The platform should support discovery, property listings, agent profiles, inquiries, favorites, and moderation.

The long-term product may support:
- buying
- renting
- land
- apartments
- houses
- commercial property
- other real-estate categories

The application must be designed so additional property types and countries can be added later.

---

# 2. CORE USER ROLES

There are three primary roles:

```text
CUSTOMER
AGENT
ADMIN
```

## CUSTOMER

A customer can:

- create an account
- sign in
- edit profile
- browse properties
- search properties
- filter properties
- sort properties
- view property details
- save/favorite properties
- contact/inquire about a property
- view their inquiries
- manage saved properties
- manage account settings
- sign out

A customer must NOT be able to:
- create listings
- edit an agent's listing
- approve listings
- access agent-only screens
- access admin screens

---

# 3. AGENT ROLE

An agent can:

- create an agent account
- sign in
- create an agent profile
- provide agency information
- submit verification information
- create property listings
- upload listing images
- edit listings
- publish listings
- unpublish listings
- delete/archive listings
- see listing status
- receive inquiries
- manage leads/inquiries
- edit their profile
- manage account settings

An agent must NOT be able to:
- approve their own verification
- approve their own listings
- access another agent's private dashboard data
- access admin-only functionality

---

# 4. ADMIN ROLE

An admin can:

- view users
- view agents
- verify agents
- reject agent verification
- view all properties
- approve/reject listings
- suspend listings
- remove inappropriate content
- view inquiries
- review reports
- manage platform content
- suspend users where appropriate
- manage moderation state

Admin functionality must be protected by server-side authorization.

Do NOT rely only on hidden frontend routes for security.

---

# 5. TECHNOLOGY DIRECTION

Use the existing project stack where practical.

Preferred:

```text
Frontend:
React
TypeScript
Vite

UI:
existing Estara design system

3D landing:
Three.js
React Three Fiber
GSAP

Backend:
Supabase preferred
or the existing project backend if one is already properly established

Database:
PostgreSQL

Authentication:
Supabase Auth or equivalent secure auth system

Storage:
Supabase Storage or equivalent object storage
```

Do not replace working technology merely for convenience.

---

# 6. APPLICATION ARCHITECTURE

Recommended high-level structure:

```text
Estara
│
├── Cinematic Landing
│   ├── Scene 01
│   ├── Scene 02
│   ├── Scene 03
│   ├── Scene 04
│   ├── Scene 05
│   └── Scene 06
│
├── Authentication
│   ├── Customer Register
│   ├── Agent Register
│   ├── Login
│   ├── Forgot Password
│   └── Reset Password
│
├── Public Marketplace
│   ├── Explore
│   ├── Search
│   ├── Property Details
│   ├── Agent Profile
│   └── Locations
│
├── Customer Application
│   ├── Dashboard
│   ├── Saved Properties
│   ├── Inquiries
│   ├── Profile
│   └── Settings
│
├── Agent Application
│   ├── Dashboard
│   ├── Listings
│   ├── Create Listing
│   ├── Edit Listing
│   ├── Inquiries
│   ├── Verification
│   ├── Profile
│   └── Settings
│
└── Admin
    ├── Overview
    ├── Users
    ├── Agents
    ├── Properties
    ├── Reports
    └── Moderation
```

---

# 7. ROUTING

Use clear route boundaries.

Suggested routes:

```text
/
 /explore
 /properties
 /properties/:id
 /agents/:id

 /login
 /register
 /register/customer
 /register/agent
 /forgot-password
 /reset-password

 /customer
 /customer/dashboard
 /customer/saved
 /customer/inquiries
 /customer/profile
 /customer/settings

 /agent
 /agent/dashboard
 /agent/listings
 /agent/listings/new
 /agent/listings/:id
 /agent/inquiries
 /agent/verification
 /agent/profile
 /agent/settings

 /admin
 /admin/dashboard
 /admin/users
 /admin/agents
 /admin/properties
 /admin/reports
 /admin/settings
```

Keep route protection centralized.

---

# 8. CINEMATIC LANDING INTEGRATION

The existing Scene 06 role selection must become functional.

Customer CTA:

```text
Explore Properties
Continue as a Customer
```

should navigate to:

```text
/register/customer
```

Agent CTA:

```text
List a Property
Continue as an Agent
```

should navigate to:

```text
/register/agent
```

Existing sign-in link:

```text
/login
```

The landing experience remains the public brand entrance.

Do not remove it.

---

# 9. DATABASE ARCHITECTURE

Use PostgreSQL.

Core tables:

```text
profiles
agents
properties
property_images
favorites
inquiries
agent_verifications
reports
notifications
```

Additional tables may be introduced only when necessary.

---

# 10. PROFILES TABLE

Recommended fields:

```text
id
auth_user_id
role
first_name
last_name
display_name
phone
email
avatar_url
bio
created_at
updated_at
status
```

Role enum:

```text
customer
agent
admin
```

Do not duplicate sensitive authentication data unnecessarily if the auth provider already stores it.

---

# 11. AGENTS TABLE

Recommended:

```text
id
profile_id
agency_name
license_number
business_phone
business_email
website
years_experience
specialties
service_locations
verification_status
verification_submitted_at
verified_at
created_at
updated_at
```

Verification states:

```text
pending
verified
rejected
suspended
```

Do not claim an agent is verified unless the platform actually marked them verified.

---

# 12. PROPERTIES TABLE

Recommended:

```text
id
agent_id
title
description
property_type
listing_type
status
price
currency
country
state_region
city
address
latitude
longitude
bedrooms
bathrooms
toilets
floor_area
land_area
year_built
furnished
parking_spaces
features
created_at
updated_at
published_at
```

Property types:

```text
apartment
house
land
commercial
office
shop
warehouse
other
```

Listing types:

```text
sale
rent
lease
```

Statuses:

```text
draft
pending_review
published
rejected
archived
sold
rented
suspended
```

---

# 13. PROPERTY IMAGES

Recommended:

```text
id
property_id
storage_path
public_url
alt_text
sort_order
is_primary
created_at
```

The property owner/agent must only be able to modify images belonging to their own listing.

---

# 14. FAVORITES

Recommended:

```text
id
user_id
property_id
created_at
```

Add a unique constraint for:

```text
user_id + property_id
```

A customer can favorite a property only once.

---

# 15. INQUIRIES

Recommended:

```text
id
property_id
customer_id
agent_id
subject
message
status
created_at
updated_at
```

Inquiry status:

```text
new
read
responded
closed
```

A customer can create an inquiry.

The associated agent can view and manage it.

Other customers/agents must not see private inquiry data.

---

# 16. REPORTS

Recommended:

```text
id
reporter_id
property_id
reported_agent_id
reason
description
status
created_at
resolved_at
```

Report status:

```text
open
investigating
resolved
dismissed
```

---

# 17. NOTIFICATIONS

Recommended:

```text
id
user_id
type
title
message
read
reference_type
reference_id
created_at
```

Potential notification events:

- inquiry received
- inquiry response
- listing approved
- listing rejected
- agent verified
- agent verification rejected

---

# 18. AUTHENTICATION

Implement:

- customer registration
- agent registration
- login
- logout
- password reset
- session persistence
- protected routes

Use secure password authentication through the selected auth provider.

Never:
- store raw passwords in the database
- place secrets in frontend source
- bypass authorization using client-only checks

---

# 19. CUSTOMER REGISTRATION

Customer form:

```text
First name
Last name
Email
Phone
Password
Confirm password
```

On successful registration:

```text
auth account
→ profile created
→ role = customer
→ customer application
```

Show a proper loading state.

Show useful validation errors.

Do not create duplicate profiles.

---

# 20. AGENT REGISTRATION

Agent form:

```text
First name
Last name
Email
Phone
Agency name
Password
Confirm password
```

After registration:

```text
auth account
→ profile role = agent
→ agent profile created
→ verification begins
```

Do not automatically mark the agent as verified.

---

# 21. LOGIN

Login screen should support:

```text
Email
Password
```

Include:

```text
Remember session
Forgot password
```

After login:

```text
customer → customer dashboard
agent → agent dashboard
admin → admin dashboard
```

Use role-aware redirects.

---

# 22. CUSTOMER DASHBOARD

Design a premium but practical dashboard.

Header:

```text
Good morning, {Name}
```

Summary:
- saved properties
- active inquiries
- recently viewed properties
- recommended properties

Main sections:

```text
Saved Properties
Recent Activity
Recommended Properties
Active Inquiries
```

Do not overload the dashboard with charts that don't provide value.

---

# 23. CUSTOMER SAVED PROPERTIES

Features:

- grid/list switch
- remove favorite
- open property
- view price
- view location
- quick inquiry

Empty state:

```text
You haven't saved any properties yet.
Start exploring places that catch your eye.
```

---

# 24. CUSTOMER INQUIRIES

Show:

```text
Property
Agent
Date
Status
Last activity
```

Clicking an inquiry opens the inquiry detail.

Protect customer private inquiries.

---

# 25. CUSTOMER PROFILE

Allow editing:

- name
- phone
- bio
- avatar
- preferences

Do not allow arbitrary role changes.

Role changes must be controlled by the system.

---

# 26. PUBLIC EXPLORE PAGE

This is the main marketplace.

Top:

```text
Find a place worth calling home.
```

Search:

```text
Search by city, area, neighborhood...
```

Filters:

```text
For Sale
For Rent

Property Type

Price Range

Bedrooms

Bathrooms

Area

Furnished

Location
```

Sort:

```text
Newest
Price: Low → High
Price: High → Low
Most Relevant
```

---

# 27. PROPERTY CARD

Each card should contain:

- primary image
- property type
- listing type
- title
- price
- location
- bedrooms
- bathrooms
- size
- favorite button
- agent identity where appropriate

Card should link to property details.

---

# 28. PROPERTY DETAIL PAGE

Layout:

```text
Gallery
↓
Title
Price
Location
Quick facts
Description
Features
Property details
Agent
Inquiry CTA
Similar properties
```

Gallery:

- primary image
- thumbnails
- fullscreen/lightbox
- keyboard support
- mobile swipe

Property detail must clearly distinguish:
- sale vs rent
- published state
- agent information

---

# 29. PROPERTY MAP

Where map functionality is used:

Prefer:

```text
Leaflet
+
OpenStreetMap
```

unless the project later gains a suitable commercial map API.

Map requirements:

- pan
- zoom
- marker
- property location
- approximate location option when exact privacy is desired
- responsive mobile interaction

Do not hard-code API keys.

---

# 30. AGENT PROFILE

Public agent profile should show:

- profile photo
- name
- agency
- verification status
- short bio
- service areas
- specialties
- active listings
- contact/inquiry action

Do not expose sensitive private agent information.

---

# 31. AGENT DASHBOARD

Primary overview:

```text
Welcome back, {Agent}
```

Metrics:

```text
Active Listings
Pending Review
Total Inquiries
Saved/Interest metrics if available
```

Recent activity:

```text
New inquiries
Listing approvals
Listing updates
```

Quick actions:

```text
Add Property
View Listings
View Inquiries
Verification
```

---

# 32. AGENT LISTINGS

Listing table/cards should show:

```text
Property
Status
Price
Views if implemented
Inquiries
Updated
Actions
```

Actions:

```text
Edit
View
Unpublish
Archive
Delete
```

Respect listing status rules.

---

# 33. CREATE PROPERTY

Create a multi-step listing form.

Step 1:

```text
Basic information
Title
Property type
Listing type
Price
Currency
```

Step 2:

```text
Location
Country
Region
City
Address
Latitude
Longitude
```

Step 3:

```text
Property details
Bedrooms
Bathrooms
Toilets
Floor area
Land area
Year built
Parking
Furnished
```

Step 4:

```text
Description
Features
Amenities
```

Step 5:

```text
Images
```

Step 6:

```text
Review & Submit
```

Save drafts.

Do not lose partially completed forms.

---

# 34. IMAGE UPLOAD

Allow multiple images.

Features:

- drag and drop
- file picker
- preview
- reorder
- primary image
- remove
- loading states
- upload errors

Validate:
- file type
- file size
- maximum image count

Compress or optimize images where practical.

Never rely only on client-side validation.

---

# 35. LISTING SUBMISSION

When agent submits:

```text
draft
→ pending_review
```

Do not immediately publish if moderation is required.

Admin reviews:

```text
approve
→ published

reject
→ rejected
```

Agent should see the reason for rejection.

---

# 36. AGENT VERIFICATION

Verification page should clearly show:

```text
Not Started
Pending Review
Verified
Rejected
Suspended
```

Use a verification workflow.

Do not request unnecessary sensitive information.

Use only fields required by the platform's actual verification process.

---

# 37. AGENT INQUIRIES

Agent can see:

```text
Customer
Property
Message
Date
Status
```

Actions:

```text
Mark read
Respond
Close
```

Customer contact information should only be shown as appropriate to the inquiry workflow.

---

# 38. ADMIN DASHBOARD

Admin overview should show useful platform metrics:

```text
Total Users
Total Agents
Pending Agent Verifications
Published Properties
Pending Property Reviews
Open Reports
New Inquiries
```

Use simple charts only where useful.

Do not create meaningless analytics.

---

# 39. ADMIN USERS

Admin can:

- search users
- filter by role/status
- view profiles
- suspend/reactivate accounts where appropriate

Do not expose passwords or authentication secrets.

---

# 40. ADMIN AGENTS

Admin can:

- review agent profiles
- review verification status
- verify
- reject
- suspend

Show:
- agency
- active listings
- verification history
- reported issues where authorized

---

# 41. ADMIN PROPERTIES

Admin can:

- search listings
- filter by status
- open detail
- approve
- reject
- suspend
- archive

Show rejection reasons.

Keep an audit-friendly status history if practical.

---

# 42. ADMIN REPORTS

Admin can review:

```text
Reported property
Reported agent
Reporter
Reason
Description
Date
Status
```

Actions:

```text
Investigate
Resolve
Dismiss
Suspend
```

Do not automatically delete things without clear rules.

---

# 43. SEARCH ARCHITECTURE

Search should be server-backed where appropriate.

Support:

- location
- title
- property type
- listing type
- price range
- bedrooms
- bathrooms
- area

Use pagination.

Do not load thousands of properties at once.

---

# 44. FILTER URL STATE

Make useful filters shareable.

Example:

```text
/explore?city=Lagos&type=apartment&listing=sale&min=50000000&max=150000000
```

Use query parameters rather than hidden frontend-only state.

---

# 45. PROPERTY SORTING

Support:

```text
relevance
newest
price_asc
price_desc
```

Do sorting server-side when result sets are large.

---

# 46. FAVORITES

Only authenticated customers can favorite.

Unauthenticated users clicking favorite should receive a clear login/register prompt.

Do not silently fail.

---

# 47. INQUIRY FLOW

Customer:

```text
Property detail
→ Contact Agent
→ inquiry form
→ submit
→ confirmation
```

Suggested form:

```text
Subject
Message
```

Use customer account information automatically where appropriate.

Agent receives notification.

---

# 48. EMPTY / LOADING / ERROR STATES

Every major application view must have:

- loading state
- empty state
- error state
- retry behavior where useful

Never leave the user staring at a blank screen.

Examples:

```text
No saved properties yet.
No listings found.
No inquiries yet.
Something went wrong loading this property.
```

---

# 49. RESPONSIVE DESIGN

Desktop:

- full dashboard navigation
- wide property grid
- large property gallery

Tablet:

- compressed navigation
- flexible grids

Mobile:

- bottom navigation or compact mobile navigation
- single-column property cards
- swipeable galleries
- touch-friendly filters
- accessible forms

Do not simply shrink desktop layouts.

---

# 50. DESIGN SYSTEM

Estara should have a consistent design language.

Use:

- strong whitespace
- refined typography
- neutral architecture-inspired surfaces
- subtle borders
- restrained shadows
- premium imagery
- consistent spacing
- consistent button hierarchy

Avoid:
- excessive rounded cards
- oversized shadows
- random colors
- excessive gradients
- generic dashboard templates

The application should feel like the same brand as the cinematic landing page.

---

# 51. NAVIGATION

Customer navigation:

```text
Explore
Saved
Inquiries
Profile
```

Agent navigation:

```text
Dashboard
Listings
Add Property
Inquiries
Verification
Profile
```

Admin:

```text
Overview
Users
Agents
Properties
Reports
```

Provide mobile navigation.

---

# 52. SECURITY

Implement proper authorization.

Use database row-level security where available.

Examples:

Customers may:
- read published properties
- manage their favorites
- create/read their own inquiries
- update their own profile

Agents may:
- manage their own listings
- manage their own listing images
- read their own inquiries
- update their own profile
- submit their own verification

Admins may:
- moderate according to admin policies

Never assume frontend route protection is sufficient.

---

# 53. DATA VALIDATION

Validate important fields on the server/backend.

Examples:

Price:
- positive number

Bedrooms:
- non-negative integer

Property type:
- allowed enum

Agent ownership:
- verified from authenticated user context

Listing updates:
- only owner or authorized admin

---

# 54. FRAUD / QUALITY CONTROLS

Build the foundation for:

- agent verification
- listing moderation
- report system
- listing status
- suspicious content handling

Do not promise that a property is legitimate unless the platform has actually verified it.

Do not label every agent as "verified" automatically.

---

# 55. NOTIFICATIONS

At minimum support in-app notifications for:

Customer:
- inquiry sent
- inquiry response

Agent:
- new inquiry
- listing approved
- listing rejected
- verification approved/rejected

Admin:
- new property awaiting review
- new agent verification request
- new report

---

# 56. PROFILE / SETTINGS

Customer settings:

```text
Profile
Email
Phone
Password
Notifications
```

Agent settings:

```text
Profile
Agency
Contact information
Password
Notifications
```

Do not expose credentials.

---

# 57. PLATFORM STATES

Use clear UI status badges.

Examples:

```text
Published
Pending Review
Draft
Rejected
Archived
Sold
Rented

Verified
Pending
Rejected
Suspended
```

Use consistent wording.

---

# 58. FUTURE EXTENSIONS

Structure the app so future features can be added without a rewrite:

- real-time messaging
- property appointments
- payments
- commissions
- agent subscriptions
- premium listings
- advanced recommendations
- saved searches
- push notifications
- reviews
- property valuation tools
- neighborhood intelligence
- multiple currencies
- multiple countries

Do not implement these unless explicitly requested later.

---

# 59. NIGERIA-FIRST READINESS

Although the cinematic destination is Cape Town, the platform should not be architecturally locked to South Africa.

Design database and forms to support Nigeria and future markets.

Support:
- NGN
- location hierarchy
- Lagos
- Abuja
- other Nigerian locations

Currency should be configurable.

Do not hard-code a single country into the entire application.

---

# 60. PLATFORM HOMEPAGE AFTER CINEMATIC EXPERIENCE

The cinematic experience remains `/`.

The actual marketplace can be entered through `/explore`.

A user who skips or finishes the cinematic intro must have a normal accessible route into the product.

---

# 61. PERFORMANCE

Application pages should not load the heavy cinematic WebGL system unnecessarily.

Prefer lazy loading for:
- dashboard bundles
- admin bundles
- heavy map components
- 3D components

Do not load the entire application into the initial landing page bundle.

---

# 62. ERROR HANDLING

Handle:
- network failures
- auth failures
- expired sessions
- database failures
- image upload failures
- permission errors
- missing properties
- missing agent profiles

Use useful user-facing messages.

Avoid exposing internal stack traces.

---

# 63. ACCESSIBILITY

Implement:
- semantic headings
- labels
- keyboard navigation
- focus states
- accessible buttons
- readable contrast
- alt text for property images
- accessible dialogs
- accessible mobile navigation

Do not make important functionality animation-dependent.

---

# 64. SEO / PUBLIC DISCOVERY

Public pages should be structured for SEO.

Property detail pages should have:
- meaningful title
- description
- location
- canonical URL where practical
- social preview metadata

Do not expose private dashboards to indexing.

---

# 65. ANALYTICS FOUNDATION

Leave hooks for future analytics.

Potential future events:

```text
property_view
property_favorite
inquiry_created
agent_registration
property_created
property_published
search_performed
```

Do not add invasive tracking.

---

# 66. DEVELOPMENT PRINCIPLES

Follow these rules throughout the implementation:

1. Reuse existing components.
2. Avoid duplicate systems.
3. Keep components focused.
4. Keep business logic outside presentation when practical.
5. Keep database access centralized.
6. Keep authorization explicit.
7. Avoid giant files.
8. Avoid magic numbers.
9. Keep environment secrets server-side.
10. Do not implement fake backend functionality.

---

# 67. BUILD ORDER

Even though this document describes the entire product, implement in dependency order:

```text
1. Inspect existing cinematic project
2. Preserve Scene 01–06
3. Establish backend connection
4. Create database schema
5. Configure authentication
6. Establish profiles and roles
7. Implement protected routes
8. Build customer registration/login
9. Build agent registration/login
10. Build application shells
11. Build public explore page
12. Build property schema and CRUD
13. Build image storage
14. Build property detail page
15. Build favorites
16. Build inquiries
17. Build agent dashboard
18. Build agent listing workflow
19. Build verification workflow
20. Build admin moderation
21. Build reports
22. Build notifications
23. Polish responsive UI
24. Test authorization
25. Test full user journeys
```

Do not skip foundational steps simply to make screenshots look good.

---

# 68. CUSTOMER JOURNEY TEST

Verify this complete journey:

```text
Landing
→ Scene 06
→ Continue as Customer
→ Register
→ Login/session
→ Customer Dashboard
→ Explore
→ Search
→ Filter
→ Open Property
→ Favorite
→ Contact Agent
→ Submit Inquiry
→ View Inquiry
→ Sign out
```

Every step must work.

---

# 69. AGENT JOURNEY TEST

Verify:

```text
Landing
→ Scene 06
→ Continue as Agent
→ Register
→ Login
→ Agent Dashboard
→ Verification
→ Submit Verification
→ Create Listing
→ Save Draft
→ Upload Images
→ Submit for Review
→ Listing Pending
→ Admin Approval
→ Listing Published
→ View Listing
→ Receive Inquiry
→ Manage Inquiry
```

Every state must be real.

---

# 70. ADMIN JOURNEY TEST

Verify:

```text
Admin Login
→ Admin Dashboard
→ Review Agent
→ Verify Agent
→ Review Property
→ Approve Property
→ View Reports
→ Resolve Report
```

Every permission must be enforced.

---

# 71. AUTHORIZATION TESTS

Explicitly verify:

- customer cannot open agent dashboard
- customer cannot edit listings
- agent cannot open admin pages
- agent cannot edit another agent's listings
- agent cannot approve their own listing
- customer cannot modify another customer's favorites/inquiries
- unauthenticated user cannot access protected dashboards
- suspended user cannot perform restricted actions

---

# 72. FINAL UX STANDARD

Estara must feel like one product.

The cinematic landing page should feel premium.

The application should feel practical.

The two should not feel like separate websites.

The transition is:

```text
cinematic story
      ↓
discovery
      ↓
platform
      ↓
action
```

---

# 73. FINAL BUILD CONSTRAINTS

DO NOT:

- delete the cinematic experience
- replace it with a generic homepage
- create fake data that pretends to be persistent
- fake authentication
- fake agent verification
- claim listings are verified without moderation
- expose private user data
- put secrets in frontend code
- make every user an admin
- hard-code role permissions only in UI
- build unnecessary features before core workflows work

DO:

- preserve Scene 01–06
- connect Scene 06 to authentication
- build the real marketplace foundation
- use real persistence
- protect routes
- protect database records
- make customer and agent experiences distinct
- make admin moderation functional
- make listings searchable
- make inquiries work
- make the UI responsive
- make errors understandable
- keep the architecture extensible

---

# 74. DEFINITION OF DONE

The application phase is complete when:

### Landing
- cinematic Scenes 01–06 work
- Customer CTA works
- Agent CTA works
- Login works

### Authentication
- customer registration works
- agent registration works
- login works
- logout works
- password reset works
- sessions persist securely

### Customer
- dashboard works
- explore works
- search works
- filters work
- property details work
- favorites work
- inquiries work
- profile works

### Agent
- dashboard works
- verification workflow works
- create listing works
- draft saving works
- image uploads work
- edit listing works
- submit-for-review works
- published listing works
- inquiry management works

### Admin
- dashboard works
- user management works
- agent verification works
- property moderation works
- reporting works

### Security
- role permissions work
- row-level authorization works
- users cannot access each other's private records
- secrets are protected

### UX
- mobile works
- tablet works
- desktop works
- loading states work
- error states work
- empty states work
- keyboard navigation works

---

# 75. FINAL INSTRUCTION TO THE BUILD AGENT

Treat this document as the master architecture and implementation specification for Estara's application.

Inspect the existing project first.

Preserve the existing cinematic landing experience.

Then implement the real platform underneath it.

Do not generate a superficial mockup.

Build the actual data relationships, authentication, permissions, listings, favorites, inquiries, agent workflows and admin moderation required for the core marketplace.

Work in dependency order.

After implementation:
- run type checks
- run production build
- verify routing
- verify authentication
- verify database access
- verify permissions
- test customer journey
- test agent journey
- test admin journey
- check responsive layouts
- fix errors before declaring completion

Do not build unrelated future features.

The final result should be a serious foundation for a real Estara product, not merely a visual prototype.

Stop only after the complete core marketplace foundation described above is implemented and connected to the existing cinematic landing page.
