# Members: sign in, profiles, the People view

The site is static (GitHub Pages). Everything member-related goes from the browser to a free Supabase project:

- Organization **The Unfinished World** (free plan), project **tuw-collective** (`pzzivuxhfpaiucbfqypw`, us-west-1).
- SQL, in order: `schema.sql` (table), then `002_profiles.sql` (sign-in-only profiles, People list, photo bucket),
  then `003_characters.sql` (the profile `figure` holds a walker character id from `bodies.js`).
- Front end: `members.js` plus the `<dialog id="joinDialog">` and `<div id="people">` in `index.html`.
  The key in `members.js` is the publishable key, which is meant to be public.

## How it works

- **Joining requires signing in with Google.** GitHub, email, phone and anonymous sign-in are switched off.
- After signing in, people fill in name, what they do, interests, a few words about themselves, and a picture.
  They choose a walker character (any archetype or everyday walker in `bodies.js`); it is their picture when
  they pick the ink figure, and the walker in the scene while they are signed in. The picture can instead be a photo:
  their Google photo, or an upload.
  They can come back and edit any of it.
- **"Show me on the People page"** is off by default. Only people who tick it appear, and emails are never shown.
- **The People view** opens by clicking the walker in the scene (the cursor changes over it) or from `#people`.
  It replaces the text column and has a Back link.
- The database only exposes three functions: `my_profile()` and `save_profile(...)` for the signed-in person, and
  `people()` for everyone. The `members` table itself is closed. Photos live in the public `avatars` bucket, and
  each person can write only to a folder named after their own account.
- Earlier form sign-ups (before sign-in existed) are kept. When that person signs in with a Google account
  that has the same email, their entry is picked up automatically.

See or export everyone: https://supabase.com/dashboard/project/pzzivuxhfpaiucbfqypw/editor (table `members`).

## Turning on Google and GitHub (one-time, account owner)

Status (2026-11-08): Google sign-in is live (Google Cloud project `tuw-collective`, published to production, with the
site's privacy page). GitHub sign-in is switched off for now: the org's OAuth app "The Unfinished World" exists, but its
client secret was exposed and must be replaced first. To bring GitHub back: delete the old secret on GitHub, generate a
new one, add `['github', 'GitHub']` back to PROVIDERS in members.js, and run
`bash ~/.config/tuw/set-provider.sh github <Ov23… client id>` with the new secret on the clipboard.

Until a provider is switched on, the dialog says "Sign-in opens soon." The buttons appear by themselves once it is.
Callback URL for both:

    https://pzzivuxhfpaiucbfqypw.supabase.co/auth/v1/callback

**GitHub** (about 3 minutes)
1. https://github.com/organizations/the-unfinished-world/settings/applications/new
2. Application name: The Unfinished World. Homepage URL: https://the-unfinished-world.github.io/the-unfinished-world/
   Authorization callback URL: the callback URL above. Register application.
3. Copy the Client ID, then Generate a new client secret and copy it.
4. https://supabase.com/dashboard/project/pzzivuxhfpaiucbfqypw/auth/providers, then GitHub: enable it, paste both, Save.

**Google** (about 10 minutes)
1. https://console.cloud.google.com, then create a project called "The Unfinished World".
2. Google Auth Platform (OAuth consent screen): External; app name The Unfinished World; your support email.
   Scopes: only the defaults (email, profile, openid). Then **Publish app** so anyone can sign in. With only these
   basic scopes, Google does not require a review.
3. Clients, then Create client, then Web application. Under Authorised redirect URIs add the callback URL above.
4. Copy the Client ID and Client secret into the Google provider on the same Supabase providers page, and Save.

Allowed redirect URLs are already set: the GitHub Pages site, http://127.0.0.1:8771 for local preview, and
https://theunfinishedworld.org for when the domain is live.

## Free-plan notes

- Supabase can pause a free project after about a week of low activity. Restore it with one click from the dashboard.
- No emails are sent; sign-in goes through Google.
