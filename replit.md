# Online Store - React Native E-commerce App

## Overview

This is a cross-platform e-commerce mobile application built with React Native and Expo. The app allows users to browse products, manage a shopping cart, maintain wishlists, and complete purchases. It includes seller functionality for adding/editing products and admin capabilities for user and district management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Framework
- **React Native with Expo SDK 52**: Chosen for cross-platform development (iOS, Android, Web) with a single codebase
- **NativeWind (TailwindCSS)**: Utility-first styling approach for consistent, responsive UI across platforms
- **React Navigation**: Handles app navigation with a combination of Stack, Tab, and Drawer navigators

### State Management
- **React Context API**: Used for global state management
  - `AuthContext`: Manages user authentication state, session, and role-based access (user/admin/superadmin)
  - `FeedbackContext`: Provides toast notifications throughout the app

### Backend & Data
- **Supabase**: Backend-as-a-Service providing:
  - Authentication (email/password)
  - PostgreSQL database for products, users, cart, wishlist, orders
  - Storage for product images
  - Row-level security for data protection

### Key Data Models
- **Products**: Items for sale with images, pricing, categories, and location data
- **Cart/Cart Items**: Shopping cart functionality per user
- **Wishlist**: User favorites
- **Profiles**: Extended user data including roles (user, admin, superadmin) and account_type (basic, starter, premium)
- **Countries/Districts**: Location hierarchy for product filtering
- **Account Type Limits**: Configurable limits for product posting by account type (basic: 3, starter: 10, premium: 30 by default)

### Account Type System
- **Basic**: Default account type, can post up to 3 products
- **Starter**: Can post up to 10 products
- **Premium**: Can post up to 30 products
- Limits are configurable by superadmins in the Admin Panel
- Account types can be changed by admins/superadmins

### Product Approval Workflow
- New products start with status "draft"
- Admin approval required to change status to "published"
- Only published products are visible to regular users browsing the marketplace

### Navigation Structure
```
RootNavigator
├── Login (unauthenticated)
└── Drawer Navigator (authenticated)
    ├── Bottom Tabs
    │   ├── Dashboard
    │   ├── Browse Products
    │   ├── Cart
    │   ├── Wishlist
    │   └── Profile
    └── Stack Screens
        ├── Product Detail
        ├── Add/Edit Product
        ├── Checkout
        ├── Order Success
        └── Admin Screens (role-gated)
```

### Animation & UX
- **React Native Reanimated**: Powers smooth animations for splash screen, product interactions, and transitions
- **Lucide React Native**: Icon library for consistent visual elements
- **Custom Splash Screen**: Animated shopping-themed loading screen

### Image Handling
- Images stored in Supabase Storage bucket named "images"
- Utility functions in `src/lib/image-utils.ts` handle URL generation and fallbacks
- Supports multiple product images with main image designation

### Role-Based Access Control
- **User**: Browse, cart, wishlist, purchase, manage own products
- **Admin**: User management, product moderation
- **SuperAdmin**: Full access including district/country management and account type changes

## External Dependencies

### Backend Services
- **Supabase**: Primary backend (configured via `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` environment variables)
  - Authentication
  - PostgreSQL database
  - File storage

### Key NPM Packages
- `@supabase/supabase-js`: Supabase client
- `@react-navigation/*`: Navigation stack, tabs, drawer
- `expo-image-picker`: Camera/gallery access for product images
- `react-native-reanimated`: Animation library
- `react-native-gesture-handler`: Touch handling
- `@react-native-async-storage/async-storage`: Local session persistence
- `lucide-react-native`: Icon components

### Development Tools
- TypeScript for type safety
- Babel with Expo preset and NativeWind plugin
- Metro bundler configured for web access on port 5000
- EAS Build for native app builds