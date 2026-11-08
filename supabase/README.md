# Sign-ups ("Join the Collective")

The site is static (GitHub Pages). Sign-ups go straight from the browser to a free Supabase project:

- Organization: **The Unfinished World** (free plan), project **tuw-collective** (`pzzivuxhfpaiucbfqypw`, us-west-1).
- Table `public.members`: name, email, bio, provider, user_id, timestamps. It is closed to the public API.
  The page can only call `join_collective(name, email, bio)` and, once signed in, `my_membership()`. See `schema.sql`.
- See or export sign-ups: https://supabase.com/dashboard/project/pzzivuxhfpaiucbfqypw/editor (table `members`; export as CSV there).
- Front end: `join.js` + the `<dialog id="joinDialog">` in `index.html`. The key in `join.js` is the publishable key,
  which is meant to be public.

Rules the function enforces: anyone can add a new email; a repeat email from the form is ignored ("already on the list");
only someone signed in with a provider that verified that same email can change an existing entry.

## Turning on "Continue with Google / X / GitHub"

The buttons appear automatically once a provider is switched on. Each provider needs an OAuth app that only the
account owner can create. Use this callback URL everywhere:

    https://pzzivuxhfpaiucbfqypw.supabase.co/auth/v1/callback

1. **Google**: console.cloud.google.com, then APIs & Services, then Credentials, then Create OAuth client ID (Web application).
   Add the callback URL above as an authorised redirect URI. Set up the consent screen with the app name
   "The Unfinished World".
2. **X**: developer.x.com, then a project and app, then User authentication settings. Turn on OAuth 1.0a with
   "Request email from users", and set the callback URL above.
3. **GitHub**: github.com/organizations/the-unfinished-world/settings/applications, then New OAuth App. Set the
   homepage to the site URL and the callback URL to the one above.

Then paste each client ID and secret into Supabase:
https://supabase.com/dashboard/project/pzzivuxhfpaiucbfqypw/auth/providers

Allowed redirect URLs (already set): the GitHub Pages site, http://127.0.0.1:8771 for local preview, and
https://theunfinishedworld.org for when the domain is live.

## Free-plan notes

- Supabase can pause a free project after about a week of low activity. Each page load does make one request to it.
  If it pauses, restore it from the dashboard. Upgrade to Pro ($25/month) if that becomes a problem.
- No emails are sent; the page shows a confirmation. Sending a welcome email would need an email service (for
  example Resend) connected in Supabase.
