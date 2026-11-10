# DND Companion

An online D&D 5e character sheet for a group of friends, with campaigns and an
Owlbear Rodeo extension.

## Links

| What | Link |
| --- | --- |
| The app | https://dndcompanion.krispypcl.workers.dev/DNDCompanion/ |
| Create an account | https://dndcompanion.krispypcl.workers.dev/DNDCompanion/signup |
| Your account | https://dndcompanion.krispypcl.workers.dev/DNDCompanion/account |
| Privacy | https://dndcompanion.krispypcl.workers.dev/DNDCompanion/privacy |
| Owlbear Rodeo extension (manifest) | https://dndcompanion.krispypcl.workers.dev/DNDCompanion/owlbear/manifest.json |

To add the extension, open a room in [Owlbear Rodeo](https://www.owlbear.rodeo/),
choose **Extensions → Add custom extension**, and paste the manifest link.

## Running it yourself

Create a `.env` with a Supabase project's URL and anon key
(`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`), run `schema.sql` once in
its SQL editor, then `npm install` and `npm run dev`. Tests: `npm test`.
