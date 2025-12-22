# Design Document: Diamond Lease Car Bidding Platform

## Document Information
- **Project Name**: Diamond Lease Car Bidding Platform
- **Version**: 1.0
- **Date**: January 2025
- **Status**: Production Ready
- **Document Type**: Technical Design Document

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Design](#4-database-design)
5. [Application Architecture](#5-application-architecture)
6. [Security & Authentication](#6-security--authentication)
7. [Real-Time System](#7-real-time-system)
8. [UI/UX Design](#8-uiux-design)
9. [Deployment & Performance](#9-deployment--performance)
10. [Future Enhancements](#10-future-enhancements)

---

## 1. Executive Summary

### 1.1 Purpose
This design document provides a comprehensive technical overview of the Diamond Lease Car Bidding Platform, detailing the architecture, design decisions, and implementation patterns.

### 1.2 System Overview
The platform is a full-stack web application enabling:
- **Administrators**: Manage vehicle inventory, lots, and user approvals
- **Business Users**: View lots and bidding results
- **Bidders**: Browse active auctions and place real-time bids

### 1.3 Key Design Principles
- **Separation of Concerns**: Clear separation between frontend, backend, and data layers
- **Role-Based Access Control**: Three-tier user system (Admin, Business User, Bidder)
- **Real-Time Updates**: Live bidding with WebSocket subscriptions
- **Mobile-First Design**: Responsive UI optimized for all device sizes
- **Security by Default**: Row-Level Security (RLS) and authentication at every layer
- **Scalability**: Designed to handle growth in users and data volume

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│                         (Frontend)                                   │
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │
│  │  Admin Portal  │  │ Business User │  │  Bidder Portal│          │
│  │                │  │    Portal     │  │                │          │
│  │ - Dashboard    │  │ - Dashboard   │  │ - Car Browse  │          │
│  │ - Car Mgmt     │  │ - Lot View    │  │ - Bidding     │          │
│  │ - Lot Mgmt     │  │ - Results     │  │ - History     │          │
│  └────────────────┘  └────────────────┘  └────────────────┘          │
│                                                                       │
│  Technology: React 18 + TypeScript + Tailwind CSS + Vite             │
│  State: Context API + Local State                                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │
                    HTTPS/REST API + WebSocket
                                 │
┌───────────────────────────────▼─────────────────────────────────────┐
│                      BACKEND LAYER                                   │
│                      (Supabase)                                      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Authentication Service                           │  │
│  │  - JWT-based authentication                                  │  │
│  │  - Password reset flows                                      │  │
│  │  - Session management                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Database Layer (PostgreSQL)                     │  │
│  │  - Relational data model                                     │  │
│  │  - Row Level Security (RLS) policies                         │  │
│  │  - Database functions & triggers                             │  │
│  │  - Automatic status management                                │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Real-time Service                                │  │
│  │  - WebSocket connections                                     │  │
│  │  - Postgres change notifications                             │  │
│  │  - Live bid updates                                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │
┌───────────────────────────────▼─────────────────────────────────────┐
│                    DEPLOYMENT LAYER                                  │
│                    (AWS Infrastructure)                              │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ AWS Amplify  │  │  CloudFront  │  │  Route 53     │            │
│  │              │  │     (CDN)     │  │    (DNS)     │            │
│  │ Static Host  │  │ Edge Cache    │  │ Domain Mgmt  │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                       │
│  Note: Final AWS configuration pending verification with Muthu      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture Patterns

**Client-Server Architecture**: SPA frontend with Supabase BaaS backend
**Three-Tier Architecture**: Presentation (React) → Application (Supabase) → Data (PostgreSQL)
**Event-Driven Architecture**: Real-time updates via WebSocket subscriptions and database triggers

### 2.3 Data Flow Diagram

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│   User   │────────▶│  React   │────────▶│ Supabase │
│  Action  │         │ Component│         │   API    │
└──────────┘         └──────────┘         └────┬─────┘
                                                 │
                                                 ▼
                                         ┌──────────────┐
                                         │  PostgreSQL  │
                                         │   Database   │
                                         └──────┬───────┘
                                                 │
                                                 ▼
                                         ┌──────────────┐
                                         │  WAL Change  │
                                         └──────┬───────┘
                                                 │
                                                 ▼
                                         ┌──────────────┐
                                         │   Realtime   │
                                         │  WebSocket    │
                                         └──────┬───────┘
                                                 │
                                                 ▼
                                         ┌──────────────┐
                                         │  UI Update    │
                                         │  (All Clients)│
                                         └──────────────┘
```

---

## 3. Technology Stack

### 3.1 Technology Stack Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND STACK                           │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  React   │  │TypeScript │  │ Tailwind │  │   Vite   │ │
│  │  18.3.1  │  │   5.5.3   │  │   3.4.1  │  │   5.4.2  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                              │
│  ┌──────────┐  ┌──────────┐                                │
│  │  Lucide  │  │   xlsx   │                                │
│  │  React   │  │  0.18.5  │                                │
│  └──────────┘  └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND STACK                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Supabase   │  │  PostgreSQL   │  │   Supabase    │    │
│  │   Platform   │  │   Database   │  │   Realtime   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Supabase Auth│  │   Database   │                        │
│  │   (JWT)      │  │  Functions   │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  DEPLOYMENT STACK                             │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ AWS Amplify  │  │  CloudFront  │  │  Route 53    │    │
│  │   (Hosting)  │  │    (CDN)     │  │   (DNS)      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
│  Note: Final AWS configuration pending verification         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.5.3 | Type safety |
| Vite | 5.4.2 | Build tool and dev server |
| Tailwind CSS | 3.4.1 | Utility-first CSS framework |
| Lucide React | 0.344.0 | Icon library |
| xlsx | 0.18.5 | Excel file processing |

### 3.3 Backend Technologies

| Technology | Service | Purpose |
|------------|---------|---------|
| Supabase | Platform | Backend-as-a-Service platform |
| PostgreSQL | Database | Relational database |
| Supabase Auth | Authentication | JWT-based authentication |
| Supabase Realtime | Real-time | WebSocket subscriptions |
| PostgreSQL Functions | Database | Business logic and triggers |

### 3.4 Deployment Technologies

| Technology | Purpose | Status |
|------------|---------|--------|
| AWS Amplify | Frontend hosting | Pending verification |
| AWS CloudFront | CDN and global distribution | Pending verification |
| Route 53 | DNS management | Pending verification |
| SSL/TLS | HTTPS encryption | Pending verification |

**Note**: Final AWS stack configuration is pending verification with Muthu. The deployment section will be updated after confirmation of the AWS and Supabase production setup.

---

## 4. Database Design

### 4.1 Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  admin_users    │         │ business_users  │         │     users       │
│                 │         │                 │         │   (bidders)      │
│ • id (PK)       │         │ • id (PK)       │         │ • id (PK)       │
│ • email         │         │ • email         │         │ • name          │
│ • password_hash │         │ • name          │         │ • email         │
│ • name          │         │ • phone         │         │ • phone         │
│ • created_at   │         │ • created_at    │         │ • approved      │
└─────────────────┘         └─────────────────┘         │ • approved_by   │
                                                         │ • approved_at   │
                                                         │ • created_at   │
                                                         └────────┬────────┘
                                                                  │
                                                                  │
                    ┌─────────────────────────────────────────────┘
                    │
                    │
         ┌──────────▼──────────┐
         │       lots           │
         │                      │
         │ • id (PK)            │
         │ • lot_number (UK)    │
         │ • bidding_start_date │
         │ • bidding_end_date   │
         │ • approved           │
         │ • approved_by (FK)   │
         │ • status             │
         │ • created_at         │
         └──────────┬───────────┘
                    │
                    │ (1:N)
                    │
         ┌──────────▼──────────┐
         │       cars           │
         │                      │
         │ • id (PK)            │
         │ • lot_id (FK)        │
         │ • sr_number          │
         │ • fleet_no           │
         │ • reg_no             │
         │ • make_model         │
         │ • year               │
         │ • km                 │
         │ • price              │
         │ • location           │
         │ • bidding_start_date │
         │ • bidding_end_date   │
         │ • bidding_enabled    │
         │ • status             │
         │ • created_at         │
         └──────────┬───────────┘
                    │
                    │ (1:N)
                    │
         ┌──────────▼──────────┐
         │       bids           │
         │                      │
         │ • id (PK)            │
         │ • car_id (FK)        │
         │ • user_id (FK)       │
         │ • amount             │
         │ • created_at         │
         └─────────────────────┘

Legend: PK = Primary Key, FK = Foreign Key, UK = Unique Key
```

### 4.2 Core Tables

**admin_users**: Admin accounts with custom authentication
- Fields: `id`, `email`, `password_hash`, `name`, `created_at`, `created_by`

**business_users**: Business user accounts (lot managers)
- Fields: `id`, `email`, `name`, `phone`, `created_at`, `created_by`

**users**: Bidder accounts linked to Supabase Auth
- Fields: `id`, `name`, `email`, `phone`, `approved`, `approved_by`, `approved_at`, `created_at`

**lots**: Groups cars into auction lots
- Fields: `id`, `lot_number`, `bidding_start_date`, `bidding_end_date`, `approved`, `approved_by`, `approved_at`, `status`, `early_closed`, `created_at`
- Status Values: `Pending`, `Approved`, `Active`, `Closed`

**cars**: Vehicle inventory and auction details
- Fields: `id`, `lot_id`, `sr_number`, `fleet_no`, `reg_no`, `make_model`, `year`, `km`, `price`, `location`, `bidding_start_date`, `bidding_end_date`, `bidding_enabled`, `status`, `created_at`, `updated_at`
- Status Values: `Disabled`, `Upcoming`, `Active`, `Closed`, `Reopened`

**bids**: Bid transactions
- Fields: `id`, `car_id`, `user_id`, `amount`, `created_at`

### 4.3 Database Functions

- **refresh_car_statuses()**: Updates all car statuses based on dates (called every 30 seconds)
- **update_all_lot_statuses()**: Updates lot statuses based on car statuses
- **update_car_statuses_for_approved_lots()**: Updates cars when lots are approved
- **force_update_all_statuses()**: Forces immediate status update

### 4.4 Row Level Security (RLS) Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RLS ACCESS MATRIX                      │
│                                                              │
│  Table          │ Admin │ Business User │ Bidder │ Public   │
│─────────────────┼───────┼───────────────┼────────┼──────────│
│ admin_users     │  R/W  │      -       │   -    │    -     │
│ business_users  │  R/W  │      R       │   -    │    -     │
│ users           │  R/W  │      -       │   R/W  │    -     │
│ lots            │  R/W  │      R       │   -    │    -     │
│ cars            │  R/W  │      R       │   R    │    R     │
│ bids            │  R/W  │      R       │   R/W  │    -     │
│                                                              │
│  Legend: R = Read, W = Write, - = No Access                 │
│  Note: Bidder can only view active cars, create own bids    │
└─────────────────────────────────────────────────────────────┘
```

**Admin Access**: Full CRUD on all tables
**Business User Access**: Read-only access to approved lots and their cars
**Bidder Access**: View active cars only, create/view own bids
**Public Access**: Anonymous users can view active cars (browsing before registration)

---

## 5. Application Architecture

### 5.1 Application Structure Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION STRUCTURE                   │
│                                                              │
│  src/                                                        │
│  ├── components/                                             │
│  │   ├── admin/          Admin Portal Components            │
│  │   │   ├── AdminDashboard.tsx                             │
│  │   │   ├── CarList.tsx                                    │
│  │   │   ├── LotManagement.tsx                              │
│  │   │   └── ...                                            │
│  │   ├── business/       Business User Components            │
│  │   │   ├── BusinessUserDashboard.tsx                       │
│  │   │   └── LotBiddingResults.tsx                          │
│  │   ├── user/           Bidder Components                  │
│  │   │   ├── UserDashboard.tsx                              │
│  │   │   ├── EnhancedCarGrid.tsx                            │
│  │   │   └── CarDetailModal.tsx                             │
│  │   ├── auth/           Authentication                      │
│  │   │   └── ResetPassword.tsx                              │
│  │   └── common/         Shared Components                  │
│  │       ├── Logo.tsx                                       │
│  │       ├── Notification.tsx                               │
│  │       └── ConfirmModal.tsx                               │
│  ├── contexts/          React Context Providers             │
│  │   ├── AuthContext.tsx                                    │
│  │   ├── NotificationContext.tsx                            │
│  │   └── ConfirmContext.tsx                                 │
│  ├── lib/              External Libraries                    │
│  │   └── supabase.ts    Supabase Client                      │
│  ├── utils/            Utility Functions                    │
│  │   ├── dateUtils.ts                                       │
│  │   └── phoneFormatter.ts                                  │
│  ├── App.tsx           Main Application Component           │
│  └── main.tsx         Application Entry Point               │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Component Hierarchy Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT HIERARCHY                      │
│                                                              │
│  App                                                         │
│  ├── NotificationProvider                                    │
│  │   ├── ConfirmProvider                                     │
│  │   │   ├── AuthProvider                                     │
│  │   │   │   └── AppContent                                   │
│  │   │   │       ├── AdminLogin (route: /admin)              │
│  │   │   │       ├── BusinessUserLogin (route: /business)    │
│  │   │   │       ├── UserAuth (route: /)                    │
│  │   │   │       ├── ResetPassword (route: /reset-password) │
│  │   │   │       ├── AdminDashboard (if admin)               │
│  │   │   │       ├── BusinessUserDashboard (if business)    │
│  │   │   │       └── UserDashboard (if bidder)              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Routing Strategy

Pathname-based routing (no React Router):
- `/admin` → Admin login/dashboard
- `/business` → Business user login/dashboard
- `/` → Bidder login/dashboard
- `/reset-password` → Password reset

### 5.4 Component Patterns

**Container-Presenter Pattern**: Container components manage state/data, presenters handle UI
**Modal Pattern**: Reusable modals for forms and details (CarEditModal, LotApprovalModal)
**Compound Components**: Components working together (NotificationContainer + Notification)

### 5.5 State Management Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT                          │
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │  Global State     │         │  Local State      │        │
│  │  (Context API)    │         │  (Component)      │        │
│  │                   │         │                   │        │
│  │ • AuthContext     │         │ • useState()      │        │
│  │ • NotificationCtx │         │ • useEffect()     │        │
│  │ • ConfirmContext  │         │ • useRef()        │        │
│  └──────────────────┘         └──────────────────┘        │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        │                                     │
│                        ▼                                     │
│           ┌──────────────────────┐                         │
│           │  Real-time Sync        │                         │
│           │  (Supabase Subscriptions)                        │
│           └──────────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

**Context API**: Global state via `AuthContext`, `NotificationContext`, `ConfirmContext`
**Local State**: Component-specific state with `useState` and `useEffect`
**Real-Time Sync**: Supabase Realtime subscriptions update local state automatically

---

## 6. Security & Authentication

### 6.1 Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION FLOWS                       │
│                                                              │
│  ADMIN AUTHENTICATION                                        │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐   │
│  │  User  │───▶│  Login │───▶│  Query  │───▶│ Verify │   │
│  │ Input  │    │  Form  │    │ admin_  │    │  Hash  │   │
│  └────────┘    └────────┘    │  users  │    └────────┘   │
│                                                              │
│  BUSINESS USER / BIDDER AUTHENTICATION                       │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐   │
│  │  User  │───▶│  Login │───▶│Supabase│───▶│  JWT    │   │
│  │ Input  │    │  Form  │    │  Auth  │    │  Token  │   │
│  └────────┘    └────────┘    └────────┘    └────────┘   │
│                                                              │
│  PASSWORD RESET FLOW                                         │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐   │
│  │ Request│───▶│  Email │───▶│  Link  │───▶│  Reset │   │
│  │  Reset │    │  Sent   │    │  Click │    │ Password│   │
│  └────────┘    └────────┘    └────────┘    └────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Authentication Methods

**Admin Authentication**: Custom authentication with password hashing stored in `admin_users` table
**Business User Authentication**: Supabase Auth with custom role and JWT tokens
**Bidder Authentication**: Supabase Auth (standard) with JWT tokens and OTP verification

### 6.3 Authorization (RBAC) Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              ROLE-BASED ACCESS CONTROL (RBAC)               │
│                                                              │
│  ┌──────────────┐                                           │
│  │    ADMIN     │───▶ Full System Access                    │
│  │              │    • All tables: CRUD                      │
│  │              │    • Approve/reject lots & bidders        │
│  │              │    • Manage business users                 │
│  └──────────────┘                                           │
│                                                              │
│  ┌──────────────┐                                           │
│  │ BUSINESS USER│───▶ Read-Only Access                      │
│  │              │    • View approved lots                    │
│  │              │    • View cars in approved lots            │
│  │              │    • View bidding results                  │
│  └──────────────┘                                           │
│                                                              │
│  ┌──────────────┐                                           │
│  │    BIDDER    │───▶ Limited Access                        │
│  │              │    • View active cars only                 │
│  │              │    • Place bids                            │
│  │              │    • View own bidding history             │
│  │              │    • Update own profile                    │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

**Admin Role**: Full access to all tables, can create/edit/delete all entities, approve/reject lots and bidders
**Business User Role**: Read-only access to approved lots, view cars and bidding results
**Bidder Role**: View active cars, place bids, view own bidding history, update own profile

### 6.4 Data Security

- **Password Security**: Bcrypt hashing (Supabase managed)
- **API Security**: JWT tokens for authenticated requests
- **RLS Policies**: Enforce data access at database level
- **HTTPS**: All production traffic encrypted
- **Input Validation**: Client-side and server-side (RLS policies)
- **SQL Injection Prevention**: Parameterized queries (Supabase handles)

---

## 7. Real-Time System

### 7.1 Real-Time Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              REAL-TIME SYSTEM ARCHITECTURE                   │
│                                                              │
│  ┌──────────┐                                               │
│  │  Client  │                                               │
│  │  (React) │                                               │
│  └────┬─────┘                                               │
│       │                                                     │
│       │ WebSocket Connection                                │
│       │                                                     │
│  ┌────▼─────────────────────────────────────┐             │
│  │     Supabase Realtime                    │             │
│  │  • WebSocket Server                      │             │
│  │  • Postgres Listener                     │             │
│  │  • Channel Management                     │             │
│  └────┬─────────────────────────────────────┘             │
│       │                                                     │
│       │ Postgres Change Events                             │
│       │                                                     │
│  ┌────▼─────────────────────────────────────┐             │
│  │     PostgreSQL Database                   │             │
│  │  • Change Triggers                        │             │
│  │  • WAL (Write-Ahead Log)                  │             │
│  │  • Transaction Log                        │             │
│  └───────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Real-Time Subscription Flow

```
┌─────────────────────────────────────────────────────────────┐
│            REAL-TIME SUBSCRIPTION FLOW                      │
│                                                              │
│  1. Component Mounts                                        │
│     ┌──────────────────────────────────────┐               │
│     │  useEffect(() => {                   │               │
│     │    const subscription = supabase      │               │
│     │      .channel('cars-changes')        │               │
│     │      .on('postgres_changes', ...)    │               │
│     │      .subscribe()                     │               │
│     │  }, [])                               │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  2. Database Change Occurs                                  │
│     ┌──────────────────────────────────────┐               │
│     │  INSERT/UPDATE/DELETE on table       │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  3. WAL Captures Change                                     │
│     ┌──────────────────────────────────────┐               │
│     │  PostgreSQL WAL logs change           │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  4. Realtime Broadcasts                                      │
│     ┌──────────────────────────────────────┐               │
│     │  Supabase Realtime sends WebSocket   │               │
│     │  message to all subscribed clients   │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  5. UI Updates                                               │
│     ┌──────────────────────────────────────┐               │
│     │  Component receives update           │               │
│     │  State updates automatically         │               │
│     │  UI re-renders with new data         │               │
│     └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Real-Time Subscriptions

**Car Status Updates**: Subscribe to `cars` table changes, reload cars on update
**Bid Updates**: Subscribe to `bids` table changes, update highest bid display
**Status Refresh**: Periodic refresh (every 30 seconds) via `refresh_car_statuses()` RPC call

### 7.4 Real-Time Features

- **Live Bid Updates**: New bids appear instantly to all connected clients
- **Status Changes**: Car/lot status updates in real-time
- **Countdown Timers**: Real-time countdown for auction end
- **Highest Bid Display**: Updates automatically when new bids placed

---

## 8. UI/UX Design

### 8.1 Design System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DESIGN SYSTEM                             │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Color System    │  │  Typography       │                │
│  │                  │  │                  │                │
│  │  Primary: Red    │  │  Font: System    │                │
│  │  Secondary: Blue │  │  Sizes: 12-36px  │                │
│  │  Text: Grey      │  │  Weights: 400-700 │                │
│  │  Bg: Light Grey  │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Spacing         │  │  Components       │                │
│  │                  │  │                  │                │
│  │  8px Grid       │  │  Buttons         │                │
│  │  4-48px Scale   │  │  Cards           │                │
│  │                 │  │  Modals          │                │
│  │                 │  │  Forms           │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Design Principles

- **Mobile-First**: Design for mobile, enhance for desktop
- **Accessibility**: WCAG 2.1 AA compliance target
- **Consistency**: Unified design language across all portals
- **Clarity**: Clear visual hierarchy and information architecture

### 8.3 Color System

**Diamond Lease Brand Colors**:
- Primary: `#DC2626` (dl-red)
- Secondary: `#1E40AF` (dl-blue)
- Text: `#6B7280` (dl-grey)
- Background: `#F9FAFB` (dl-grey-bg)

**Semantic Colors**:
- Success: `#10B981` (Green)
- Warning: `#F59E0B` (Amber)
- Error: `#EF4444` (Red)
- Info: `#3B82F6` (Blue)

### 8.4 Typography & Spacing

**Font**: System sans-serif stack
**Sizes**: Headings (24-36px), Body (16px), Small (14px)
**Weights**: Bold (700), Semibold (600), Medium (500), Regular (400)
**Spacing**: 8px base grid system (4px, 8px, 16px, 24px, 32px, 48px)

### 8.5 Responsive Design

**Breakpoints**: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`
**Mobile Optimizations**: Touch targets (44px minimum), swipe gestures, bottom navigation, collapsible filters, full-width modals

---

## 9. Deployment & Performance

### 9.1 Deployment Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  DEPLOYMENT ARCHITECTURE                     │
│                                                              │
│  ┌──────────────┐                                           │
│  │ User Browser │                                           │
│  └──────┬───────┘                                           │
│         │ HTTPS                                             │
│         │                                                   │
│  ┌──────▼──────────────────────────────────┐              │
│  │      AWS CloudFront (CDN)                │              │
│  │  • Global edge locations                 │              │
│  │  • SSL/TLS termination                  │              │
│  │  • Static asset caching                 │              │
│  └──────┬──────────────────────────────────┘              │
│         │                                                   │
│  ┌──────▼──────────────────────────────────┐              │
│  │      AWS Amplify / S3                   │              │
│  │  • Static site hosting                  │              │
│  │  • Build artifacts                      │              │
│  │  • Environment variables                │              │
│  └──────┬──────────────────────────────────┘              │
│         │                                                   │
│  ┌──────▼──────────────────────────────────┐              │
│  │      Supabase (Backend)                 │              │
│  │  • Database (PostgreSQL)                │              │
│  │  • Authentication                       │              │
│  │  • Real-time                            │              │
│  └─────────────────────────────────────────┘              │
│                                                              │
│  Note: Final AWS configuration pending verification        │
│  with Muthu. Deployment section will be updated after      │
│  confirmation of AWS and Supabase production setup.        │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Build & Deployment Process

```
┌─────────────────────────────────────────────────────────────┐
│              BUILD & DEPLOYMENT PROCESS                     │
│                                                              │
│  1. Development                                             │
│     ┌──────────────────────────────────────┐               │
│     │  npm run dev                         │               │
│     │  • Vite dev server                   │               │
│     │  • Hot module replacement             │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  2. Build                                                   │
│     ┌──────────────────────────────────────┐               │
│     │  npm run build                       │               │
│     │  • Minified JavaScript               │               │
│     │  • Optimized CSS                     │               │
│     │  • Asset optimization                │               │
│     │  • Output: dist/ folder              │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  3. Deploy                                                  │
│     ┌──────────────────────────────────────┐               │
│     │  AWS Amplify                         │               │
│     │  • Connect GitHub repo               │               │
│     │  • Configure build settings          │               │
│     │  • Set environment variables         │               │
│     │  • Deploy                            │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  4. Configure                                               │
│     ┌──────────────────────────────────────┐               │
│     │  CloudFront + Route 53               │               │
│     │  • Create distribution               │               │
│     │  • Configure SSL certificate         │               │
│     │  • Set up custom domain             │               │
│     └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

**Build Process**: `npm run build` creates optimized `dist/` folder with minified JS/CSS
**Environment Variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
**Deployment Steps**: Build → Deploy to AWS Amplify → Configure CloudFront → Set up DNS

**Note**: Final AWS stack configuration is pending verification with Muthu. The deployment section will be updated after confirmation of the AWS and Supabase production setup.

### 9.3 Performance Optimizations

**Frontend**:
- Code splitting (future: route-based lazy loading)
- Asset optimization (lazy loading, tree-shaking)
- Bundle size: CSS 22.39 KB (4.58 KB gzipped), JS 758.60 KB (236.26 KB gzipped)

**Database**:
- Indexes on foreign keys, status, and date fields
- Selective queries (only fetch needed columns)
- RLS policies for server-side filtering

**Real-Time**:
- Subscription cleanup on component unmount
- Selective subscriptions (only needed channels)
- Debouncing for rapid updates

**Caching**:
- Browser caching: Static assets (1 year), HTML (no-cache)
- CDN caching: CloudFront caches static assets at edge

### 9.4 Scalability

**Current Limits** (Supabase Free Tier):
- Database: 500 MB
- API Requests: 50,000/month
- Realtime Connections: 200 concurrent
- Storage: 1 GB

**Scaling Strategies**:
- Vertical scaling: Upgrade Supabase plan
- Horizontal scaling: Read replicas (Supabase Pro)
- CDN: CloudFront for global distribution
- Caching: Aggressive caching of static assets

**Performance Targets**:
- Page load time: < 3 seconds
- API response time: < 500ms
- Database query time: < 100ms
- Real-time latency: < 100ms

### 9.5 Error Handling & Resilience

**Error Types**: Network errors, authentication errors, authorization errors, validation errors, server errors
**Error Handling**: Try-catch blocks, error notifications, logging
**Resilience**: Automatic retry for transient errors, WebSocket reconnection, session refresh
**User Feedback**: Toast notifications, inline errors, loading states, skeleton loaders

---

## 10. Future Enhancements

### 10.1 Planned Features

1. **Image Upload**: Car photo galleries
2. **Email/SMS Notifications**: Bid alerts, auction reminders, OTP
3. **Advanced Analytics**: Dashboard with charts and visualizations
4. **Payment Integration**: Stripe/PayPal for bid deposits
5. **Mobile Apps**: Native iOS/Android applications
6. **Multi-Language**: i18n support
7. **Advanced Search**: Full-text search, enhanced filters

### 10.2 Technical Improvements

1. **Code Splitting**: Route-based lazy loading with React.lazy()
2. **Testing**: Comprehensive test suite (Jest, React Testing Library, Cypress)
3. **CI/CD**: Automated testing and deployment pipelines
4. **Performance**: Further optimizations (virtual scrolling, memoization)
5. **Accessibility**: WCAG 2.1 AAA compliance
6. **PWA**: Progressive Web App features (offline support, installable)

---

## Appendix A: API Reference

### A.1 Authentication Endpoints
- Admin Login: Custom authentication via `admin_users` table
- Business User/Bidder Login: `POST /auth/v1/token?grant_type=password`
- Password Reset: `POST /auth/v1/recover`

### A.2 Data Endpoints
- Cars: `GET/POST/PATCH/DELETE /rest/v1/cars`
- Lots: `GET/POST/PATCH /rest/v1/lots`
- Bids: `GET/POST /rest/v1/bids`
- Users: `GET/PATCH /rest/v1/users`

### A.3 RPC Functions
- `POST /rest/v1/rpc/refresh_car_statuses`
- `POST /rest/v1/rpc/update_all_lot_statuses`
- `POST /rest/v1/rpc/force_update_all_statuses`

### A.4 Real-Time Subscriptions
```typescript
supabase
  .channel('cars-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, callback)
  .subscribe()
```

---

## Appendix B: Glossary

- **RLS**: Row Level Security - Database-level access control
- **BaaS**: Backend as a Service - Cloud backend platform
- **JWT**: JSON Web Token - Authentication token format
- **WAL**: Write-Ahead Log - PostgreSQL transaction log
- **CDN**: Content Delivery Network - Global content distribution
- **SPA**: Single Page Application - Web app architecture
- **OTP**: One-Time Password - Temporary authentication code

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2025 | Development Team | Initial design document |

---

**End of Design Document**
