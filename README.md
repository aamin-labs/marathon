# Marathon

A personal marathon training app: your own plan, a calendar you can rearrange, heat-adjusted paces, strength sessions and shoe mileage.

## Run it

```bash
npm run dev
```

Then open http://localhost:5180. Stop it with Ctrl+C.

Other commands: `npm test` checks the pace maths and plan reader; `npm run build` checks the whole app compiles.

## How it fits together

- `src/lib/parse.ts` reads the plan text (the format is described at the top of the file and on the Setup screen).
- `src/lib/pace.ts` turns a goal time into paces and applies the heat adjustment.
- `src/lib/store.ts` holds all data and saves it in the browser (`localStorage`). Nothing is sent anywhere.
- `src/Today.tsx`, `Plan.tsx`, `Shoes.tsx`, `Setup.tsx` are the four screens; `Sheet.tsx` is the workout detail panel.

Data lives only in the browser you use, at this exact address. Use Setup → Backup before clearing browser data.

## Not built yet

1. A live check of "Fetch completed runs". It reads finished runs and their laps back from intervals.icu, but was built from the API specification and tested against made-up responses, not a real account. Runs that reach intervals.icu through Strava cannot be read by the API.
2. Hosting, so the app opens on the phone away from this Mac.
3. The real plan: the built-in plan is a generic placeholder. `marathon-plans/breeze-80.txt` holds all 18 weeks of Breeze 80 from Marathon Excellence, ready to paste into Setup → Plan. `marathon-plans/breeze.md` is the book's tables with their ranges, for reference.
