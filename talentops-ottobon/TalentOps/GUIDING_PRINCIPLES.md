# Guiding Principles: Talent Ops

> "Build for Scale, Secure by Default, Delight by Design."

## 1. Core Philosophy

### 🛡️ Server-Authoritative Architecture
*   **Trust No Client**: The frontend is strictly a presentation layer. All business logic, validation, and state mutations must occur on the server (Supabase RPCs/Edge Functions).
*   **Data Integrity First**: Prevent race conditions and inconsistent states by handling complex operations (like Payroll generation or Attendance calculations) atomically in the database.

### 🔒 Zero-Trust Security Model
*   **Role-Based Access Control (RBAC)**: Every table and RPC must enforce strict RLS policies.
    *   *Employees* access only their own data.
    *   *Managers* access their direct reports' data.
    *   *Executives/Admins* have organization-wide visibility.
*   **Field-Level Security**: Sensitive columns (salary, private notes) are never exposed to the frontend unless explicitly authorized.

## 2. User Experience (UX)

### ✨ "Wow" Factor
*   **Premium Aesthetics**: The application should feel like a high-end product. Use rich colors, smooth gradients, and glassmorphism where appropriate.
*   **Responsive & Alive**: Every interaction should provide immediate feedback. Use micro-animations, hover effects, and skeleton loaders to create a dynamic feel.
*   **Simplicity**: Complex workflows (like Reviews or Payroll) must be broken down into intuitive, guided steps for the user.

## 3. Engineering Standards

### 🏗️ Modular Monolith
*   **Domain-Driven Design**: Code takes the shape of the business. Modules (Attendance, Payroll, Project Management) should be self-contained but integrated through shared core entities (Users, Profiles).
*   **Type Safety**: Use TypeScript for all frontend code and auto-generated types for database schemas to ensure end-to-end type safety.

### 🧹 Code Quality
*   **Clean & Maintainable**: Write code that is easy to read and understand. Avoid deep nesting and "magic numbers".
*   **Single Source of Truth**: Data (like user profile info) should live in one place and be referenced everywhere, never duplicated.

## 4. Specific Principles from "The Plan"
*(To be populated with insights from the external plan)*
*   [Principle 1]
*   [Principle 2]
*   [Principle 3]
