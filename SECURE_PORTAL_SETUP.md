# Secure Portal Setup

This marketing site can stay on GitHub Pages, but the client portal now expects Supabase for real security.

## 1. Create a Supabase project
- Create a new Supabase project.
- In `SQL Editor`, run `/Users/dasiamitchell/Desktop/real-estate-site/supabase-schema.sql`.

## 2. Add your project keys
Edit `/Users/dasiamitchell/Desktop/real-estate-site/portal-config.js` and set:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

The anon key is safe for browser use when RLS is configured correctly.

## 3. Create your first admin
- Sign up once through the live auth flow or Supabase Auth.
- In Supabase SQL, promote that user:

```sql
update public.profiles
set role = 'admin', portal_status = 'active'
where id = 'USER_UUID_HERE';
```

## 4. Seed milestones or blog posts
Use the admin dashboard after login, or insert directly into:
- `public.blog_posts`
- `public.portal_milestones`
- `public.demo_files`

## 5. Recommended production hardening
- Enable MFA for admin accounts.
- Set a strong password policy in Supabase Auth.
- Use a separate subdomain like `portal.tlgproperties.org` for the portal.
- Keep marketing pages public, keep storage buckets private.
- Add audit logging for admin changes if you extend this further.

## 6. Important limitation
The portal pages are now app-ready, but GitHub Pages is still just static hosting. Security comes from Supabase auth, storage policies, and RLS. Do not rely on hidden URLs alone.
