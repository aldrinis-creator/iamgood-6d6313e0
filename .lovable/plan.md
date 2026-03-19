

# My Profile with Military-Grade Encryption (AES-256-GCM)

## Overview

Build a dedicated **My Profile** page accessible from the user menu (alongside Settings and Logout). It displays personal info, body metrics with BMI, primary guardian, encrypted government IDs, and health information — matching the screenshots. Sensitive data (Aadhaar, PAN) is encrypted client-side using **AES-256-GCM** (Web Crypto API) before being stored in the database. A user-set 6-digit vault PIN derives the encryption key via PBKDF2.

## Architecture

```text
User enters Aadhaar/PAN
        │
        ▼
  [6-digit Vault PIN]
        │
  PBKDF2 (100K iterations, SHA-256)
        │
        ▼
  AES-256-GCM encrypt
        │
        ▼
  Store ciphertext + IV + salt in DB
        │
  (on read) PIN → PBKDF2 → AES-256-GCM decrypt → display
```

## Database Changes

### 1. Add columns to `profiles` table
- `gender` (text, nullable)
- `weight_kg` (numeric, nullable)
- `height_m` (numeric, nullable)

### 2. Create `encrypted_documents` table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | references auth.users |
| doc_type | text | 'aadhaar', 'pan', 'passport', etc. |
| encrypted_value | text | Base64 ciphertext |
| iv | text | Base64 initialization vector |
| salt | text | Base64 PBKDF2 salt |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| UNIQUE(user_id, doc_type) | | |

RLS: Users can only CRUD their own rows.

### 3. Create `vault_pins` table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid UNIQUE | |
| pin_hash | text | SHA-256 hash of PIN for verification |
| created_at | timestamptz | |

RLS: Users can only manage their own PIN.

## Files to Create/Modify

### New Files
1. **`src/lib/encryption.ts`** — AES-256-GCM encrypt/decrypt utilities using Web Crypto API
   - `deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey>` — PBKDF2 100K iterations
   - `encrypt(plaintext: string, pin: string): Promise<{ciphertext, iv, salt}>` — AES-256-GCM
   - `decrypt(ciphertext, iv, salt, pin): Promise<string>` — AES-256-GCM
   - `hashPin(pin: string): Promise<string>` — SHA-256 for PIN verification

2. **`src/pages/MyProfile.tsx`** — Full profile page with sections:
   - **View Details / Edit Profile** toggle (matching screenshot)
   - **Personal Information**: Full Name, DOB (with age calc), Mobile Number, Gender
   - **Body Metrics**: Weight (kg), Height (m), auto-calculated BMI with status color
   - **Primary Guardian**: Shows primary guardian card with status badge and call button
   - **Government ID Cards**: Aadhaar + PAN with AES-256-GCM encryption, vault PIN gate
   - **Health Information**: Blood group, allergies, conditions (from `health_profile` table)

### Modified Files
3. **`src/components/AppHeader.tsx`** — Add "My Profile" to the user dropdown menu
4. **`src/App.tsx`** — Add `/my-profile` route
5. **`mem://index.md`** — Document encryption approach

## Encryption Flow (User Experience)

1. **First time**: User goes to Government ID Cards section → prompted to set a 6-digit Vault PIN
2. **Adding ID**: Enter PIN → enter Aadhaar/PAN → encrypted with AES-256-GCM → stored as ciphertext
3. **Viewing ID**: Enter PIN → PIN hash verified → ciphertext decrypted → shown briefly with eye toggle
4. **PIN never stored in plaintext** — only its SHA-256 hash for quick verification before attempting decryption

## Security Properties
- **AES-256-GCM**: NIST-approved, used by US DoD — qualifies as "military grade"
- **PBKDF2 with 100K iterations**: Brute-force resistant key derivation
- **Per-document random IV and salt**: No two encryptions produce the same ciphertext
- **Zero-knowledge**: Server never sees plaintext IDs or the PIN
- **Client-side only**: Decryption happens in browser; database holds only ciphertext
- **RLS protection**: Database rows restricted to authenticated owner

## Profile Page Layout (matching screenshots)

```text
┌──────────────────────────────┐
│  My Profile                  │
│  Manage your health info     │
│  [View Details] [Edit Profile]│
├──────────────────────────────┤
│ 👤 Personal Information      │
│  Full Name: Aldrin ALPHONSO  │
│  DOB: 16/7/1969 (56 yrs)    │
│  Mobile: +91 9819576467      │
│  Gender: Male                │
├──────────────────────────────┤
│ ⚖️ Weight: 95.0 kg           │
│ 📏 Height: 1.80 m            │
│ 📊 BMI: 29.3 — Overweight   │
├──────────────────────────────┤
│ ⭐ Primary Guardian          │
│  Lira Alphonso [Accepted] 📞 │
│  +91 99671 34652             │
├──────────────────────────────┤
│ 🔒 Government ID Cards       │
│  Aadhaar: ●●●●●●●● [Saved]  │
│  PAN: ●●●●●●●●●●● [Saved]   │
│  [View ID Card Images]       │
├──────────────────────────────┤
│ ❤️ Health Information         │
│  Blood Group, Allergies, etc │
└──────────────────────────────┘
```

